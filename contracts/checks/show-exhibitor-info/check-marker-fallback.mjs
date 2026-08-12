#!/usr/bin/env node
// THE SAFETY DEVICE HAS NO OFF SWITCH — proven with the switch flipped.
//
// WHY THIS CHECK EXISTS (QA finding F-5, and the sibling stream's S2 before it)
// ----------------------------------------------------------------------------
// Every honesty marker on this page renders text that comes from three unvalidated Sanity string
// fields: pendingLabel, researchLabel, questionLabel. @qa cleared all three and measured the
// result on the rendered page: **23 bordered boxes still rendered and every one of them was
// empty.** A sighted reader got 23 empty rectangles. A screen-reader user got nothing at all —
// the only remaining content in each box was `<span aria-hidden="true">※</span>`. The researched
// convention stayed on the page; the thing marking it as *not SAOC policy* silently vanished.
//
// One editor clearing one field in Studio, with no validation warning and no visible error, turns
// the entire page from "researched convention, offered for correction" into "SAOC's rules". That
// is the exact harm the mission exists to prevent, reachable by a keystroke.
//
// So the marker gets a floor that no dataset value can lower: a constant inside the component,
// used when the Sanity label is missing or blank. A safety device must not have an off switch,
// and the off switch here was an empty text field.
//
// HOW THIS CHECK COUNTS — and why it does not count the copy
// ----------------------------------------------------------
// The obvious check is "the marker text still renders". It cannot be written that way: the whole
// scenario under test is the labels being gone, so there is no dataset copy left to search for,
// and hardcoding the expected fallback string here would pass just as happily against a page with
// that string frozen into JSX. Counting the ※ glyph fails for a different reason — it is copy
// too, and it is `aria-hidden`, so counting it would score a screen-reader-invisible box as a
// working marker.
//
// Instead the count is STRUCTURAL: `data-exhibitor-marker`, an attribute that exists for no
// reason except to be counted, derived from neither the dataset nor the copy. The check reads how
// many markers the page renders at baseline, clears the labels, and requires the same number of
// markers to still be there AND every one of them to still carry non-empty visible text. This
// mirrors the sibling contract's A60.
//
// Exit codes: 0 = proven, cleanup verified. 1 = ordinary failure. 2 = RESIDUE ALERT — the labels
// were cleared and could not be restored, which means the live page is rendering empty markers
// right now. Treat that as a content incident, not as a failing test.

import {
  runCheck,
  fetchPage,
  getSanityClient,
  loadEnvOrFail,
  callRevalidate,
  INFO_DOC_ID,
  PATHS,
} from './_shared.mjs';
import {
  EXIT_CODE_RESIDUE_ALERT,
  commitAndCaptureRev,
  isRevisionConflict,
  withDatasetLock,
} from './_mutation-guard.mjs';

const LABEL_FIELDS = ['pendingLabel', 'researchLabel', 'questionLabel'];

// Same budget as the round-trip check, and for the same reason: propagation is bounded by the
// Sanity CDN (sanity/lib/fetch.ts sets useCdn:true), not by /api/revalidate. QA measured 64–96s
// under concurrent load. A timeout that trips on a slow CDN reports "the fallback is broken" when
// the fallback is fine — while holding the labels cleared.
const POLL_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 10_000;

const MARKER_ATTR = 'data-exhibitor-marker';
const MARKER_ELEMENT = new RegExp(`<([a-z]+)[^>]*\\b${MARKER_ATTR}\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');

// Every marker on the page, with the text a human would actually read out of it. `aria-hidden`
// content is stripped first: a box containing only the decorative glyph is an empty marker to a
// screen reader, and scoring it as present is how F-5 went unnoticed.
function extractMarkers(html) {
  const markers = [];
  for (const m of html.matchAll(MARKER_ELEMENT)) {
    const inner = m[2]
      .replace(/<[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/[a-z]+>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    markers.push({ status: /data-exhibitor-marker="([^"]*)"/.exec(m[0])?.[1] ?? null, text: inner });
  }
  return markers;
}

async function poll(predicate, label) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    attempt += 1;
    const result = await predicate();
    console.log(
      `  [${label}] attempt ${attempt} (t+${Math.round((Date.now() - start) / 1000)}s): ${JSON.stringify(result)}`,
    );
    if (result.ok) return { ok: true, attempts: attempt, last: result };
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
  return { ok: false, attempts: attempt };
}

await runCheck('check-marker-fallback', async (r) => {
  const secret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
  const client = getSanityClient({ withToken: true });

  const residue = await withDatasetLock('check-marker-fallback', () => proveFallback(r, client, secret));

  // Raised after the lock's `finally` has released, so this exit unwinds nothing. See the same
  // pattern and the same reasoning in check-cms-round-trip.mjs.
  if (residue) {
    console.error(`Exiting ${EXIT_CODE_RESIDUE_ALERT} (RESIDUE ALERT), not 1.`);
    process.exit(EXIT_CODE_RESIDUE_ALERT);
  }
});

// Returns true if the labels could not be restored — the caller turns that into exit 2.
async function proveFallback(r, client, secret) {
  let residueDetected = false;

  // Baseline captured inside the lock, for the same reason as everywhere else in this contract.
  const projection = LABEL_FIELDS.join(', ');
  const baseline = await client.fetch(`*[_id == $id][0]{ ${projection}, _rev }`, { id: INFO_DOC_ID });
  let currentRev = baseline?._rev;

  if (typeof currentRev !== 'string' || currentRev === '') {
    r.fail(`${INFO_DOC_ID} has a readable _rev`, `got ${JSON.stringify(currentRev)}`);
    return false;
  }

  const baselineLabels = {};
  for (const field of LABEL_FIELDS) {
    const value = baseline?.[field];
    if (typeof value !== 'string' || value.trim() === '') {
      // Not a poisoned baseline — a plain refusal. Clearing a field that is already clear proves
      // nothing, and restoring a blank would leave the page in the broken state on purpose.
      r.fail(
        `${INFO_DOC_ID}.${field} holds a real label before the perturbation`,
        `got ${JSON.stringify(value)} — this check clears these fields and puts them back, so it ` +
          'needs real ones. A blank label here is itself the F-5 defect, live right now.',
      );
      return false;
    }
    baselineLabels[field] = value;
  }

  // --- Phase 0 — how many markers does the page render normally? ---------------------------
  const before = await fetchPage(PATHS.exhibitors);
  r.check(before.status === 200, `${PATHS.exhibitors} returns 200 before the perturbation`);
  const baselineMarkers = extractMarkers(before.body);

  r.check(
    baselineMarkers.length > 0,
    `the page renders markers carrying ${MARKER_ATTR} (${baselineMarkers.length} found)`,
    `no element on ${PATHS.exhibitors} carries ${MARKER_ATTR}. This attribute exists so the count ` +
      'survives the labels being cleared; without it there is nothing left to count once the copy ' +
      'is gone, which is precisely the state F-5 describes.',
  );
  if (baselineMarkers.length === 0) return false;

  const baselineEmpty = baselineMarkers.filter((m) => m.text.length === 0);
  r.check(
    baselineEmpty.length === 0,
    'every marker carries visible text at baseline',
    `${baselineEmpty.length} of ${baselineMarkers.length} markers render no text a screen reader ` +
      'would announce, before anything has even been perturbed',
  );

  let cleared = false;

  try {
    // --- Phase 1 — clear all three labels ---------------------------------------------------
    // `unset`, not empty strings: QA measured both and they behave identically on the page, and
    // unset is the state an editor actually produces by selecting the text and deleting it.
    const patchResult = await client
      .patch(INFO_DOC_ID, { ifRevisionID: currentRev })
      .unset(LABEL_FIELDS)
      .commit();
    currentRev = patchResult._rev;
    cleared = true;
    console.log(`Cleared ${LABEL_FIELDS.join(', ')} on ${INFO_DOC_ID}`);

    const reval = await callRevalidate(secret, INFO_DOC_ID);
    r.check(reval.status === 200, '/api/revalidate accepted the invalidation', `status ${reval.status}`);

    const propagated = await poll(async () => {
      const { status, body } = await fetchPage(PATHS.exhibitors);
      const markers = extractMarkers(body);
      const gone = !body.includes(baselineLabels.pendingLabel);
      return {
        ok: status === 200 && gone,
        status,
        markers: markers.length,
        pendingLabelGone: gone,
      };
    }, 'labels-cleared');

    r.check(
      propagated.ok,
      'the cleared labels reached the rendered page (so what follows is measuring the real state)',
      'the old label text is still on the page after the propagation window, so this run cannot ' +
        'tell a working fallback from a stale cache. Not a fallback failure — an inconclusive run.',
    );

    if (propagated.ok) {
      const { body } = await fetchPage(PATHS.exhibitors);
      const markers = extractMarkers(body);

      r.check(
        markers.length === baselineMarkers.length,
        `all ${baselineMarkers.length} markers still render with every label cleared (${markers.length} found)`,
        `the marker COUNT changed from ${baselineMarkers.length} to ${markers.length}. The count ` +
          'must not depend on the copy: a marker that disappears when its text is blank is a ' +
          'marker an editor can switch off by accident.',
      );

      const empty = markers.filter((m) => m.text.length === 0);
      r.check(
        empty.length === 0,
        'every marker still carries non-empty visible text with all three labels cleared',
        `${empty.length} of ${markers.length} markers rendered as an empty box. This is F-5 ` +
          'exactly: a sighted reader sees blank rectangles, a screen-reader user is told nothing ' +
          'at all, and the researched convention on the page reads as settled SAOC policy. The ' +
          'fallback must be a constant inside the component, not another Sanity field.',
      );

      // The fallback must be ONE constant, not per-status copy improvised in the component. If
      // several different strings appear, someone has reintroduced editable-looking text.
      const distinct = new Set(markers.map((m) => m.text));
      r.check(
        distinct.size === 1,
        `the fallback is a single constant string (${distinct.size} distinct marker texts)`,
        `saw ${JSON.stringify([...distinct].slice(0, 5))}. With every Sanity label cleared, every ` +
          'marker should fall through to the same last-resort constant.',
      );
    }
  } finally {
    console.log('--- Cleanup: restoring the three labels (always attempted) ---');
    let restored = !cleared;
    try {
      if (cleared) {
        currentRev = await commitAndCaptureRev(client, INFO_DOC_ID, baselineLabels, currentRev);
        const after = await client.fetch(`*[_id == $id][0]{ ${projection} }`, { id: INFO_DOC_ID });
        restored = LABEL_FIELDS.every((f) => after?.[f] === baselineLabels[f]);
        await callRevalidate(secret, INFO_DOC_ID);
      }

      if (!restored) {
        console.error(
          '\n' +
            '='.repeat(78) +
            `\nRESIDUE ALERT — ${INFO_DOC_ID} label fields\n` +
            'The three marker labels were cleared and could not be restored. The live exhibitor ' +
            'page is rendering EMPTY honesty markers right now.\n' +
            `Restore by hand in Studio:\n${JSON.stringify(baselineLabels, null, 2)}\n` +
            '='.repeat(78) +
            '\n',
        );
        r.fail(
          'cleanup restored all three marker labels',
          'residue was left behind — see the RESIDUE ALERT above',
        );
        residueDetected = true;
      } else if (cleared) {
        console.log('Cleanup verified: all three labels restored to their captured values.');
      }
    } catch (err) {
      console.error(
        '\n' +
          '='.repeat(78) +
          `\nRESIDUE ALERT — cleanup threw for ${INFO_DOC_ID}\n` +
          (isRevisionConflict(err)
            ? 'REVISION CONFLICT: something else wrote to this document while the check held it. ' +
              'The restore was REFUSED rather than clobbering that writer, so the labels may still ' +
              'be cleared. Reconcile by hand.\n'
            : '') +
          `labels to restore:\n${JSON.stringify(baselineLabels, null, 2)}\n` +
          `error: ${err.stack ?? err.message}\n` +
          '='.repeat(78) +
          '\n',
      );
      r.fail('cleanup completed without throwing', `cleanup threw: ${err.message}`);
      residueDetected = true;
    }
  }

  return residueDetected;
}
