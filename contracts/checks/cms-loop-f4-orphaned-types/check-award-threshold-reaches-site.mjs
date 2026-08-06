#!/usr/bin/env node
// F4 (cms-loop-and-wiring): A1 — the headline round trip for `award`. Structurally
// identical to F6/F2's round trips (same six steps, same cleanup discipline, same
// hard-fail-on-timeout rule), with one deliberate difference: the target field's
// correct STEADY STATE is real, non-empty content (the backfilled `threshold` value),
// not empty. This is intentional — it directly proves the exact content
// docs/f4-orphaned-types-recon.md found was silently dropped during seeding
// (threshold has no schema field at all today) is both restored AND observably live,
// not just present in the dataset.
//
//   1. Baseline: dataset field MUST equal AWARD_AM_THRESHOLD_VALUE exactly ('80–89
//      pts', verbatim from lib/data/awards.ts) — not empty, not missing. If it does
//      not, this is a hard FAIL precondition violation, and the message says why
//      (schema field/backfill not done, wrong doc, etc.) rather than misreporting it
//      as a propagation failure below.
//   2. Open the deployed Studio (award is a COLLECTION type — uses
//      AWARD_STRUCTURE_PATH's `award;<id>` deep link, not the bare doc id), type a
//      unique sentinel into `threshold`, publish.
//   3. Confirm the publish landed in the dataset.
//   4. Call POST /api/revalidate with `_type: 'award'` — the real _type a webhook
//      payload for this document would send.
//   5. Poll the LIVE PUBLIC /judging page for the sentinel, bounded at 120s / 10s —
//      identical bound to F6/F2's A1, not lengthened. Hard FAIL on timeout.
//   6. ALWAYS attempt cleanup: restore the EXACT original value (AWARD_AM_THRESHOLD_
//      VALUE, not empty), re-publish, re-revalidate, and verify via BOTH the dataset
//      AND the live page that the SENTINEL (not the original value) is gone. Cleanup
//      failing is a hard FAIL.
//
// A sentinel appearing on /judging cannot be explained by the static
// `lib/data/awards` import (it has no random nonce) — if this passes, it is
// unambiguous proof the page is reading from Sanity for this field, not the static
// fallback. See contract header "WHY A STATIC ORDER/CONTENT CHECK ALONE PROVES
// NOTHING" for why this dynamic proof matters more than checking the six codes exist.
//
// EXPECTED RESULT TODAY: FAIL, and likely at the PRECONDITION step, not propagation —
// `threshold` does not exist on the `award` schema at all yet (confirmed live,
// 2026-08-05: the field is simply absent from every award document). Once @dev adds
// the field and backfills it, the precondition will pass and the check will proceed
// to the Studio step; propagation will still fail until F1 (CDN purge, same mission)
// also lands, for the same layered reason F2's A1 documents. Do not weaken this
// check, lengthen its bound, or retarget it to manufacture a pass before both the
// schema/backfill AND F1 are actually done.
//
// Run as: node contracts/checks/cms-loop-f4-orphaned-types/check-award-threshold-reaches-site.mjs
// Requires SANITY_API_TOKEN and SANITY_REVALIDATE_SECRET in .env.local.
// Exit codes: 0 = sentinel appeared within bound AND cleanup verified. 1 = precondition
// violated, timeout, unreachable host, auth failure, field not found, or cleanup could
// not be verified — never a skip.

import {
  getSanityClient,
  readDatasetField,
  fetchPublicPageContains,
  callRevalidate,
  openAuthenticatedDoc,
  setFieldAndPublish,
  loadEnvOrFail,
  verifyLiveAbsence,
  raiseResidueAlert,
  installCrashGuard,
  announceRuntimeExpectations,
  announceCleanupPhase,
  EXIT_CODE_RESIDUE_ALERT,
} from '../f6-prove-cms-loop/_shared.mjs';
import {
  AWARD_DOC_ID,
  AWARD_STRUCTURE_PATH,
  AWARD_PAGE_PATH,
  AWARD_REVALIDATE_TYPE,
  AWARD_THRESHOLD_FIELD,
  AWARD_AM_THRESHOLD_VALUE,
} from './_award-target.mjs';

// PROPAGATION bound (proves the feature works) — separate from cleanup verification's
// own, more conservative safety-net bound (_shared.mjs's verifyLiveAbsence, added
// 2026-08-06 after a real cleanup-failure incident on F6's A1).
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 10_000;

const nonce = `F4-AWARD-THRESHOLD-PROOF-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
installCrashGuard({ checkName: 'f4-check-award-threshold-reaches-site', docId: AWARD_DOC_ID, field: AWARD_THRESHOLD_FIELD, sentinelValue: nonce, pagePath: AWARD_PAGE_PATH });

const revalidateSecret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
const client = getSanityClient();
announceRuntimeExpectations('f4-check-award-threshold-reaches-site');
console.log(`Sentinel value: ${nonce}`);
console.log(`Target: ${AWARD_DOC_ID}.${AWARD_THRESHOLD_FIELD}, public page ${AWARD_PAGE_PATH}, revalidate type ${AWARD_REVALIDATE_TYPE}`);

async function poll(predicate, label) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    attempt += 1;
    const result = await predicate();
    console.log(`  [${label}] attempt ${attempt} (t+${Math.round((Date.now() - start) / 1000)}s):`, JSON.stringify(result));
    if (result.ok) return { ok: true, result, attempts: attempt };
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { ok: false, attempts: attempt };
}

let browser;
let mutationAttempted = false;
// 0 = full pass, 1 = ordinary fail (no residue), 2 = residue alert.
let exitCode = 1;

try {
  console.log('--- Step 1: baseline (must equal the known-correct backfilled value) ---');
  const baselineField = await readDatasetField(client, AWARD_DOC_ID, AWARD_THRESHOLD_FIELD);
  if (baselineField !== AWARD_AM_THRESHOLD_VALUE) {
    console.error(
      `FAIL: precondition violated — ${AWARD_DOC_ID}.${AWARD_THRESHOLD_FIELD} is ${JSON.stringify(baselineField)}, ` +
        `expected exactly ${JSON.stringify(AWARD_AM_THRESHOLD_VALUE)}. This is expected before @dev adds the ` +
        '`threshold` field to sanity/schemas/documents/award.ts and backfills the six real values — see the ' +
        'contract header "EXPECTED PRE-FIX RESULTS". Not a propagation failure; the round trip never started.'
    );
    process.exit(1);
  }
  console.log('Baseline dataset field:', baselineField, '(matches expected production value)');

  console.log('--- Step 2: open Studio, edit, publish ---');
  const opened = await openAuthenticatedDoc(AWARD_DOC_ID, AWARD_THRESHOLD_FIELD, AWARD_STRUCTURE_PATH);
  browser = opened.browser;
  mutationAttempted = true;
  await setFieldAndPublish(opened.page, opened.field, nonce);

  console.log('--- Step 3: confirm publish landed in the dataset ---');
  const afterPublish = await readDatasetField(client, AWARD_DOC_ID, AWARD_THRESHOLD_FIELD);
  if (afterPublish !== nonce) {
    console.error(`FAIL: Studio publish did not land — dataset shows ${JSON.stringify(afterPublish)}, expected ${JSON.stringify(nonce)}`);
  } else {
    console.log('Publish confirmed in dataset.');

    console.log('--- Step 4: call /api/revalidate ---');
    const revalRes = await callRevalidate(revalidateSecret, AWARD_REVALIDATE_TYPE);
    console.log('revalidate response:', revalRes);
    if (revalRes.status !== 200) {
      console.error(`FAIL: /api/revalidate returned ${revalRes.status}, expected 200 — cannot proceed to the propagation check`);
    } else {
      console.log('--- Step 5: poll the live public page for the sentinel ---');
      const propagation = await poll(async () => {
        const r = await fetchPublicPageContains(nonce, AWARD_PAGE_PATH);
        return { ok: r.hasNeedle, status: r.status, hasNeedle: r.hasNeedle };
      }, 'propagation');

      if (propagation.ok) {
        console.log(`PASS (propagation): sentinel appeared on the live page after ${propagation.attempts} attempt(s).`);
        exitCode = 0;
      } else {
        console.error(
          `FAIL (propagation): sentinel never appeared on ${AWARD_PAGE_PATH} within ${POLL_TIMEOUT_MS / 1000}s of a ` +
            'confirmed Studio publish + a 200 response from /api/revalidate. Expected until F1 (CDN purge) has landed.'
        );
      }
    }
  }
} catch (err) {
  console.error(`FAIL: unexpected error — ${err.stack ?? err.message}`);
} finally {
  if (mutationAttempted) {
    announceCleanupPhase();
    console.log('--- Cleanup: restoring the exact original value and re-publishing (always attempted) ---');
    let cleanupOk = false;
    let afterCleanupDataset;
    try {
      if (browser) await browser.close();
      const reopened = await openAuthenticatedDoc(AWARD_DOC_ID, AWARD_THRESHOLD_FIELD, AWARD_STRUCTURE_PATH);
      browser = reopened.browser;
      await setFieldAndPublish(reopened.page, reopened.field, AWARD_AM_THRESHOLD_VALUE);

      afterCleanupDataset = await readDatasetField(client, AWARD_DOC_ID, AWARD_THRESHOLD_FIELD);
      const datasetClean = afterCleanupDataset === AWARD_AM_THRESHOLD_VALUE;
      console.log('Dataset after cleanup:', afterCleanupDataset, '| restored to expected value:', datasetClean);

      const cleanupRevalidate = await callRevalidate(revalidateSecret, AWARD_REVALIDATE_TYPE);
      console.log('Cleanup revalidate response:', cleanupRevalidate);

      // Cleanup only needs to confirm the SENTINEL is gone (not that the correct
      // value is visibly live again) — proving the correct value is live is what A1's
      // OWN success already does, and re-checking it here would make cleanup verification
      // depend on the same CDN propagation this check is honestly expected to fail on
      // today, which would make an already-good cleanup falsely report as broken.
      console.log('--- Verifying live-page absence of the sentinel (requires 3 consecutive clean reads, up to 5 min) ---');
      const cleanupPropagation = await verifyLiveAbsence(nonce, AWARD_PAGE_PATH);

      cleanupOk = datasetClean && cleanupPropagation.ok;
      if (!cleanupOk) {
        console.error(
          'FAIL: cleanup could not be verified — ' +
            (!datasetClean ? `dataset shows ${JSON.stringify(afterCleanupDataset)}, expected ${JSON.stringify(AWARD_AM_THRESHOLD_VALUE)}. ` : '') +
            (!cleanupPropagation.ok ? 'live page did not reach 3 consecutive clean reads within the safety-net window. ' : '')
        );
      } else {
        console.log('Cleanup verified: dataset restored to the expected value AND the live page sustained absence of the sentinel.');
      }
    } catch (cleanupErr) {
      console.error(`Cleanup threw — ${cleanupErr.stack ?? cleanupErr.message}`);
      cleanupOk = false;
    }

    if (!cleanupOk) {
      raiseResidueAlert({
        checkName: 'f4-check-award-threshold-reaches-site',
        docId: AWARD_DOC_ID,
        field: AWARD_THRESHOLD_FIELD,
        expectedValue: AWARD_AM_THRESHOLD_VALUE,
        sentinelValue: nonce,
        pagePath: AWARD_PAGE_PATH,
        extra: `Dataset value observed at cleanup time: ${JSON.stringify(afterCleanupDataset)}`,
      });
      exitCode = EXIT_CODE_RESIDUE_ALERT;
    }
  }
  if (browser) await browser.close();
}

if (exitCode === 0) console.log('PASS: Studio edit reached the live judging page, and cleanup was verified.');
else if (exitCode === EXIT_CODE_RESIDUE_ALERT) console.log('RESULT: RESIDUE ALERT (see above) — do not treat as an ordinary FAIL.');
else console.log('RESULT: FAIL (see above).');
process.exit(exitCode);
