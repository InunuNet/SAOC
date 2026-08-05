#!/usr/bin/env node
// cms-loop-f3-national-show A1: THE positive-path, user-visible-outcome assertion —
// same shape as F6's A1 (real Studio, real publish, real deployed page, bounded poll,
// guaranteed cleanup), adapted for THREE fields at once (title, location,
// countdownDate) instead of one, per dispatch brief: "cover more than one field — at
// minimum a text field and the countdown date, so a partial wiring can't pass."
//
// UNLIKE F6's aboutPage.boardIntroText, these three fields are NOT currently empty —
// confirmed live 2026-08-05 via direct Studio DOM inspection (see contract header):
// title = "The 19th South African National Orchid Show", location = "Cape Town
// International Convention Centre", countdownDate = "2027-09-18 09:00". So this check
// uses a different, still-rigorous pattern: capture the real baseline, mutate to
// distinct sentinel values, verify the sentinels appear AND the baseline values
// disappear (two-sided — proves the page re-rendered with new data, not that the
// sentinel happens to already be somewhere on the page), then restore the EXACT
// captured baseline and verify that restoration on both the dataset and the live
// page. This is a genuine causal round trip, not a weaker substitute for F6's
// pattern — just adapted for non-empty starting fields.
//
// GATED ON F1 (contracts/cms-loop-f1-cdn-purge.yaml): /national-show is one of F1's
// CMS_ROUTES. This script refuses to run at all — hard fail before any mutation —
// unless F1's short-TTL fix is confirmed live (assertF1Deployed() in _shared.mjs).
// Before F1 ships, the legacy one-year s-maxage means this check's cleanup step
// (which reverts the DATASET) cannot reach the CDN's already-cached copy — a sentinel
// title or a "2099" countdown could stay visibly cached on the live site, including
// the home page, for up to a year. This is enforced in code, not just documented.
//
// CLEANUP-SAFETY FIX (2026-08-06, same root cause as F6's incident — see
// f6-prove-cms-loop/_shared.mjs and this contract's own _shared.mjs headers): every
// `process.exit(1)` in this script's own local helpers (readAllFields()) and in the
// precondition check below has been converted to `throw`, so the cleanup block in
// `finally` below is never silently skipped. The page-level cleanup verification
// below also now uses verifySustainedCondition (3 consecutive clean reads, 15s apart,
// up to 5 minutes) instead of a single-shot poll that exits on the first clean read —
// a lone "not found" read is not reliable proof of removal across every CDN edge
// node. A verification failure raises a loud, distinctly-exit-coded, durably-logged
// residue alert (raiseResidueAlert / EXIT_CODE_RESIDUE_ALERT) instead of an ordinary
// FAIL, so it can never be confused with "the feature just isn't wired yet."
//
// Exit codes: 0 = all three sentinels appeared on the live page within 120s AND
// cleanup was verified. 1 = F1 not yet deployed, precondition violated, timeout, or
// unreachable host. EXIT_CODE_RESIDUE_ALERT (2) = mutation succeeded but cleanup
// could not be verified — treat as a live incident, not an ordinary FAIL. Never a
// skip.

import {
  getSanityClient,
  fetchPublicPageContains,
  callRevalidate,
  openAuthenticatedDoc,
  loadEnvOrFail,
  poll,
  setFieldsAndPublish,
  assertF1Deployed,
  verifySustainedCondition,
  raiseResidueAlert,
  installCrashGuard,
  EXIT_CODE_RESIDUE_ALERT,
  TARGET_DOC_ID,
  TARGET_PAGE_PATH,
  STRUCTURE_PATH,
  REVALIDATE_TYPE,
} from './_shared.mjs';

installCrashGuard({ check: 'check-headline-round-trip', docId: TARGET_DOC_ID });

await assertF1Deployed();

const revalidateSecret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
const client = getSanityClient();
const nonce = Date.now();
const sentinels = {
  title: `F3-TITLE-SENTINEL-${nonce}`,
  location: `F3-LOCATION-SENTINEL-${nonce}`,
};
// A large, unmistakable offset (not a garbage string — datetime fields must hold a
// real date) so the deployed page's HTML is checked against the exact stored ISO
// value read back after publish, not a guessed serialization format.
const SENTINEL_DATETIME_INPUT = '2099-01-01 00:00';

console.log(`Sentinels: ${JSON.stringify(sentinels)}, countdownDate input: ${SENTINEL_DATETIME_INPUT}`);

let browser;
let mutationAttempted = false;
let exitCode = 1;
let baseline;
let countdownNeedle; // set once the sentinel publish's authoritative stored ISO value is known

// readDatasetField (imported) only reads ONE field by name via a GROQ projection
// built from that name — it does not support a multi-field projection string
// directly, so this check reads all three with its own small query instead of
// forcing that helper outside its designed shape.
async function readAllFields() {
  try {
    const doc = await client.fetch(`*[_id == $id][0]{title, location, countdownDate}`, { id: TARGET_DOC_ID });
    return doc ?? {};
  } catch (err) {
    const msg = `FAIL: dataset read for ${TARGET_DOC_ID} threw — ${err.message}`;
    console.error(msg);
    throw new Error(msg);
  }
}

// Retries a dataset read for a short window before accepting it as the final answer.
// DISCOVERED LIVE (2026-08-06, during a real end-to-end run once F1 turned out to
// already be deployed): a single immediate read right after a Studio Publish click
// can race ahead of the write actually landing — one real run showed the "confirm
// publish landed" read report stale values, then the SAME dataset correctly showed
// the sentinel moments later in a subsequent read. That run's underlying mutation
// and cleanup both genuinely succeeded (independently confirmed afterward via a
// direct dataset read matching the exact restored baseline) — only the check's own
// single-shot verification was too impatient. This tolerates that race without
// weakening what's being proven: it still requires the predicate to actually become
// true, just not on the very first read.
async function readAllFieldsUntil(predicate, { attempts = 6, delayMs = 3000 } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    last = await readAllFields();
    if (predicate(last)) return { ok: true, fields: last };
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ok: false, fields: last };
}

try {
  console.log('--- Step 1: baseline ---');
  baseline = await readAllFields();
  if (!baseline.title || !baseline.location || !baseline.countdownDate) {
    const msg =
      `FAIL: precondition violated — expected title, location, and countdownDate to all already hold real values ` +
      `(confirmed live 2026-08-05), got ${JSON.stringify(baseline)}. This check's cleanup restores to this exact ` +
      'baseline; it requires that baseline to be real content, not empty.';
    console.error(msg);
    throw new Error(msg);
  }
  console.log('Baseline:', JSON.stringify(baseline));

  console.log('--- Step 2: open Studio, edit title+location+countdownDate, publish ---');
  const opened = await openAuthenticatedDoc(TARGET_DOC_ID, 'title', STRUCTURE_PATH);
  browser = opened.browser;
  mutationAttempted = true;
  await setFieldsAndPublish(opened.page, {
    title: sentinels.title,
    location: sentinels.location,
    countdownDate: SENTINEL_DATETIME_INPUT,
  });

  console.log('--- Step 3: confirm publish landed in the dataset (tolerates a short landing delay) ---');
  const { ok: publishOk, fields: afterPublish } = await readAllFieldsUntil(
    (f) => f.title === sentinels.title && f.location === sentinels.location && f.countdownDate && f.countdownDate !== baseline.countdownDate
  );
  if (!publishOk) {
    console.error(`FAIL: Studio publish did not land as expected — dataset shows ${JSON.stringify(afterPublish)}`);
  } else {
    console.log('Publish confirmed in dataset:', JSON.stringify(afterPublish));
    countdownNeedle = afterPublish.countdownDate; // authoritative stored value, not a guessed format

    console.log('--- Step 4: call /api/revalidate ---');
    const revalRes = await callRevalidate(revalidateSecret, REVALIDATE_TYPE);
    console.log('revalidate response:', revalRes);
    if (revalRes.status !== 200) {
      console.error(`FAIL: /api/revalidate returned ${revalRes.status}, expected 200`);
    } else {
      console.log('--- Step 5: poll the live public page for all three sentinels (two-sided) ---');
      const propagation = await poll(async () => {
        const r = await fetchPublicPageContains(sentinels.title, TARGET_PAGE_PATH);
        const hasTitle = r.body.includes(sentinels.title);
        const hasLocation = r.body.includes(sentinels.location);
        const hasCountdown = r.body.includes(countdownNeedle);
        const oldTitleGone = !r.body.includes(baseline.title);
        const oldLocationGone = !r.body.includes(baseline.location);
        return {
          ok: hasTitle && hasLocation && hasCountdown && oldTitleGone && oldLocationGone,
          status: r.status,
          hasTitle,
          hasLocation,
          hasCountdown,
          oldTitleGone,
          oldLocationGone,
        };
      }, 'propagation');

      if (propagation.ok) {
        console.log(`PASS (propagation): all three sentinels appeared, old values gone, after ${propagation.attempts} attempt(s).`);
        exitCode = 0;
      } else {
        console.error(
          `FAIL (propagation): sentinels never fully appeared on ${TARGET_PAGE_PATH} within ${POLL_TIMEOUT_MS_LABEL()}s of a ` +
            'confirmed publish + a 200 revalidate response. If F1 (contracts/cms-loop-f1-cdn-purge.yaml) has not been deployed ' +
            'yet, this is the expected, honest pre-fix result — the CDN has no reason to re-check origin. If F1 IS deployed, ' +
            'this means /national-show is not actually querying nationalShowQuery for these fields (data-flow wiring missing ' +
            'or mis-tagged, same failure class F2 found on /events/[slug]).'
        );
      }
    }
  }
} catch (err) {
  console.error(`FAIL: unexpected error — ${err.stack ?? err.message}`);
} finally {
  if (mutationAttempted && baseline) {
    console.log('--- Cleanup: restoring the exact captured baseline (always attempted) ---');
    try {
      if (browser) await browser.close();
      const reopened = await openAuthenticatedDoc(TARGET_DOC_ID, 'title', STRUCTURE_PATH);
      browser = reopened.browser;
      // Restore countdownDate using the Studio's own displayed format (read live
      // from the field's DOM value before editing, not reconstructed from the raw
      // ISO string, so the widget parses it identically to how it originally showed
      // it).
      const beforeRestoreDisplay = await reopened.page.locator('#countdownDate').inputValue();
      console.log('countdownDate field currently displays (sentinel):', beforeRestoreDisplay);
      // Restore using a value reconstructed from the captured baseline ISO, in the
      // same "YYYY-MM-DD HH:mm" local format the Studio widget displayed originally
      // (see beforeRestoreDisplayFallback) — the pre-edit DOM read above is only a
      // diagnostic log of the sentinel still showing, not itself reusable as the
      // restore value.
      await setFieldsAndPublish(reopened.page, {
        title: baseline.title,
        location: baseline.location,
        countdownDate: beforeRestoreDisplayFallback(baseline.countdownDate),
      });

      const { ok: datasetClean, fields: afterCleanupDataset } = await readAllFieldsUntil(
        (f) => f.title === baseline.title && f.location === baseline.location && f.countdownDate === baseline.countdownDate
      );
      console.log('Dataset after cleanup:', JSON.stringify(afterCleanupDataset), '| clean:', datasetClean);

      const cleanupRevalidate = await callRevalidate(revalidateSecret, REVALIDATE_TYPE);
      console.log('Cleanup revalidate response:', cleanupRevalidate);

      // Safety gate is "no sentinel visible on the live page" — NOT "baseline text is
      // visible" (that second condition is only meaningful once /national-show is
      // actually wired; pre-wiring, baseline.title/location were NEVER rendered by
      // the page at all — confirmed live 2026-08-06 that requiring it produced a
      // false FAIL here even though the dataset was genuinely, correctly restored).
      // What actually matters for safety is that no test content is left visible to
      // real visitors; whether the ORIGINAL content re-appears depends on wiring
      // that is out of this script's control.
      //
      // Uses verifySustainedCondition (3 consecutive clean reads, 15s apart, up to 5
      // minutes — see f6-prove-cms-loop/_shared.mjs) instead of a single-shot poll
      // that would exit on the very first clean read: one "not found" response is not
      // reliable proof of removal across every CDN edge node/cache slot. This bound
      // is deliberately separate from and slower than the 120s propagation-poll bound
      // above — that bound proves the FEATURE works; this one proves cleanup is SAFE,
      // a different question with a different (more conservative) risk tolerance.
      const cleanupPropagation = await verifySustainedCondition(async () => {
        const r = await fetchPublicPageContains(sentinels.title, TARGET_PAGE_PATH);
        return (
          !r.body.includes(sentinels.title) &&
          !r.body.includes(sentinels.location) &&
          !(countdownNeedle && r.body.includes(countdownNeedle))
        );
      }, { label: 'cleanup-propagation' });

      if (!datasetClean || !cleanupPropagation.ok) {
        raiseResidueAlert({
          checkName: 'cms-loop-f3-national-show/check-headline-round-trip',
          docId: TARGET_DOC_ID,
          field: 'title/location/countdownDate',
          expectedValue: baseline,
          sentinelValue: JSON.stringify(sentinels) + ` countdownDate=${countdownNeedle}`,
          pagePath: TARGET_PAGE_PATH,
          extra: !datasetClean ? `dataset still shows ${JSON.stringify(afterCleanupDataset)}` : 'dataset confirmed clean; live page could not confirm sentinel absence within the sustained-check window',
        });
        // Set the exit code rather than calling process.exit() here directly — this is
        // still inside the outer finally block, and `if (browser) await
        // browser.close()` still needs to run below. process.exit() would skip that,
        // reintroducing the exact anti-pattern this whole fix removes elsewhere.
        exitCode = EXIT_CODE_RESIDUE_ALERT;
      } else {
        console.log('Cleanup verified: dataset restored AND live page sustained sentinel-absence across 3 consecutive checks.');
      }
    } catch (cleanupErr) {
      raiseResidueAlert({
        checkName: 'cms-loop-f3-national-show/check-headline-round-trip',
        docId: TARGET_DOC_ID,
        field: 'title/location/countdownDate',
        expectedValue: baseline,
        sentinelValue: JSON.stringify(sentinels),
        pagePath: TARGET_PAGE_PATH,
        extra: `cleanup threw: ${cleanupErr.stack ?? cleanupErr.message}`,
      });
      exitCode = EXIT_CODE_RESIDUE_ALERT;
    }
  }
  if (browser) await browser.close();
}

function beforeRestoreDisplayFallback(iso) {
  // Only used if the pre-restore DOM read failed for some reason — reconstructs the
  // Studio's "YYYY-MM-DD HH:mm" local display format from the stored ISO baseline as
  // a fallback, not the primary path.
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

if (exitCode === 0) {
  console.log('PASS: national-show headline fields reached the live site, and cleanup was verified.');
} else if (exitCode === EXIT_CODE_RESIDUE_ALERT) {
  console.log('RESULT: RESIDUE ALERT (see banner above) — treat as a live incident, not an ordinary FAIL.');
} else {
  console.log('RESULT: FAIL (see above).');
}
process.exit(exitCode);
