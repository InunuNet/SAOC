#!/usr/bin/env node
// F6 (cms-activation-deploy): THE assertion this mission was created to prove — a
// secretary edits a field in the deployed Studio, publishes, and the change appears
// on the deployed public site, with no developer involved. See the contract header
// for the full design rationale (why this field, why this timeout, what this does and
// does not prove about the Sanity webhook). Summary of the mechanics this script
// drives, in order:
//   1. Baseline: read the target field from the live dataset AND the live public page
//      — must be empty/absent on both, or the test's own precondition is violated.
//   2. Open the deployed Studio (authenticated via localStorage token injection, the
//      mechanism F2 already proved works), type a unique sentinel value into
//      aboutPage.boardIntroText, click Publish.
//   3. Confirm the publish landed in the dataset (authoritative Content Lake read).
//   4. Call POST /api/revalidate with the correct secret and the document's real
//      _type — the same call a configured Sanity webhook would make.
//   5. Poll the LIVE PUBLIC PAGE (never the Studio, never the dataset API) for the
//      sentinel string to appear in the rendered HTML, bounded by
//      POLL_TIMEOUT_MS/POLL_INTERVAL_MS. A timeout is a HARD FAIL, not inconclusive.
//   6. ALWAYS (even after a failure above) attempt cleanup: clear the field, publish
//      again, re-revalidate, and verify via BOTH the dataset AND the live page —
//      requiring several CONSECUTIVE clean reads, not just one (see _shared.mjs's
//      verifyLiveAbsence header) — that the sentinel is gone. A cleanup that cannot
//      be verified raises a loud, distinctly-exit-coded RESIDUE ALERT (exit 2), never
//      a silent pass or an ordinary-looking FAIL — see _shared.mjs's 2026-08-06
//      header for the incident that made this necessary.
//
// Run as: node contracts/checks/f6-prove-cms-loop/check-studio-edit-reaches-site.mjs
// Requires SANITY_API_TOKEN and SANITY_REVALIDATE_SECRET in .env.local, network access
// to the deployed host, and a working Playwright/Chromium install.
// Exit codes: 0 = sentinel appeared within bound AND cleanup verified clean. 1 =
// precondition violated, propagation timeout (but cleanup verified clean), unreachable
// host, or auth failure BEFORE any mutation was attempted. 2 = RESIDUE ALERT — a
// mutation was made and cleanup could NOT be verified; manual check required. Never a
// skip.

import {
  getSanityClient,
  readDatasetField,
  fetchPublicPageContains,
  callRevalidate,
  openAuthenticatedAboutPageDoc,
  setFieldAndPublish,
  loadEnvOrFail,
  verifyLiveAbsence,
  raiseResidueAlert,
  installCrashGuard,
  EXIT_CODE_RESIDUE_ALERT,
  TARGET_DOC_ID,
  TARGET_FIELD,
  TARGET_PAGE_PATH,
} from './_shared.mjs';

// Bound is not arbitrary — @architect polled the live host for 108s straight (10
// attempts, 12s apart) after a real publish + real revalidate call and observed ZERO
// movement (identical CDN cache hit, `age` header climbing monotonically the entire
// time — see contract header). 120s gives a small margin over what was actually
// tested, not an optimistic guess at an untested longer window. This is the
// PROPAGATION bound (proving the feature works) — deliberately NOT the same bound
// used for cleanup verification (see _shared.mjs's verifyLiveAbsence, a separate,
// more conservative safety-net check).
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 10_000;

const nonce = `F6-LOOP-PROOF-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
installCrashGuard({ checkName: 'f6-check-studio-edit-reaches-site', docId: TARGET_DOC_ID, field: TARGET_FIELD, sentinelValue: nonce, pagePath: TARGET_PAGE_PATH });

const revalidateSecret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
const client = getSanityClient();
console.log(`Sentinel value: ${nonce}`);
console.log(`Target: ${TARGET_DOC_ID}.${TARGET_FIELD}, public page ${TARGET_PAGE_PATH}`);

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
// exitCode: 0 = full pass, 1 = ordinary fail (no residue), 2 = residue alert (set only
// by the cleanup block below, and only if cleanup cannot be verified clean).
let exitCode = 1;

try {
  console.log('--- Step 1: baseline ---');
  const baselineField = await readDatasetField(client);
  if (baselineField != null && String(baselineField).trim().length > 0) {
    console.error(
      `FAIL: precondition violated — ${TARGET_DOC_ID}.${TARGET_FIELD} is not empty (${JSON.stringify(baselineField)}). ` +
        'This check requires starting from an empty field so the sentinel and the restore are unambiguous. ' +
        'Do not run this against a document with real content already in this field.'
    );
    process.exit(1); // safe: mutationAttempted is still false, nothing to clean up
  }
  const baselinePage = await fetchPublicPageContains(nonce);
  console.log('Baseline dataset field:', baselineField, '| baseline page:', baselinePage);

  console.log('--- Step 2: open Studio, edit, publish ---');
  const opened = await openAuthenticatedAboutPageDoc();
  browser = opened.browser;
  mutationAttempted = true;
  await setFieldAndPublish(opened.page, opened.field, nonce);

  console.log('--- Step 3: confirm publish landed in the dataset ---');
  const afterPublish = await readDatasetField(client);
  if (afterPublish !== nonce) {
    console.error(`FAIL: Studio publish did not land — dataset shows ${JSON.stringify(afterPublish)}, expected ${JSON.stringify(nonce)}`);
    // fall through to cleanup in finally; exitCode stays 1
  } else {
    console.log('Publish confirmed in dataset.');

    console.log('--- Step 4: call /api/revalidate ---');
    const revalRes = await callRevalidate(revalidateSecret, 'aboutPage');
    console.log('revalidate response:', revalRes);
    if (revalRes.status !== 200) {
      console.error(`FAIL: /api/revalidate returned ${revalRes.status}, expected 200 — cannot proceed to the propagation check`);
    } else {
      console.log('--- Step 5: poll the live public page for the sentinel ---');
      const propagation = await poll(async () => {
        const r = await fetchPublicPageContains(nonce);
        return { ok: r.hasNeedle, status: r.status, hasNeedle: r.hasNeedle };
      }, 'propagation');

      if (propagation.ok) {
        console.log(`PASS (propagation): sentinel appeared on the live page after ${propagation.attempts} attempt(s).`);
        exitCode = 0;
      } else {
        console.error(
          `FAIL (propagation): sentinel never appeared on ${TARGET_PAGE_PATH} within ${POLL_TIMEOUT_MS / 1000}s of a ` +
            'confirmed Studio publish + a 200 response from /api/revalidate.'
        );
      }
    }
  }
} catch (err) {
  console.error(`FAIL: unexpected error — ${err.stack ?? err.message}`);
} finally {
  if (mutationAttempted) {
    console.log('--- Cleanup: clearing the field and re-publishing (always attempted) ---');
    let cleanupOk = false;
    let afterCleanupDataset;
    try {
      // Re-open a fresh Studio session for cleanup in case the original page/browser
      // is in a bad state after a failure above.
      if (browser) await browser.close();
      const reopened = await openAuthenticatedAboutPageDoc();
      browser = reopened.browser;
      await setFieldAndPublish(reopened.page, reopened.field, '');

      afterCleanupDataset = await readDatasetField(client);
      const datasetClean = afterCleanupDataset == null || String(afterCleanupDataset).trim().length === 0;
      console.log('Dataset after cleanup:', afterCleanupDataset, '| clean:', datasetClean);

      const cleanupRevalidate = await callRevalidate(revalidateSecret, 'aboutPage');
      console.log('Cleanup revalidate response:', cleanupRevalidate);

      console.log(`--- Verifying live-page absence (requires ${3} consecutive clean reads, up to 5 min) ---`);
      const cleanupPropagation = await verifyLiveAbsence(nonce, TARGET_PAGE_PATH);

      cleanupOk = datasetClean && cleanupPropagation.ok;
      if (!cleanupOk) {
        console.error(
          'FAIL: cleanup could not be verified — ' +
            (!datasetClean ? `dataset still shows ${JSON.stringify(afterCleanupDataset)}. ` : '') +
            (!cleanupPropagation.ok ? `live page did not reach ${3} consecutive clean reads within the safety-net window. ` : '')
        );
      } else {
        console.log('Cleanup verified: dataset field is empty AND the live page sustained absence of the sentinel.');
      }
    } catch (cleanupErr) {
      console.error(`Cleanup threw — ${cleanupErr.stack ?? cleanupErr.message}`);
      cleanupOk = false;
    }

    if (!cleanupOk) {
      raiseResidueAlert({
        checkName: 'f6-check-studio-edit-reaches-site',
        docId: TARGET_DOC_ID,
        field: TARGET_FIELD,
        expectedValue: '',
        sentinelValue: nonce,
        pagePath: TARGET_PAGE_PATH,
        extra: `Dataset value observed at cleanup time: ${JSON.stringify(afterCleanupDataset)}`,
      });
      exitCode = EXIT_CODE_RESIDUE_ALERT;
    }
  }
  if (browser) await browser.close();
}

if (exitCode === 0) console.log('PASS: Studio edit reached the live site, and cleanup was verified.');
else if (exitCode === EXIT_CODE_RESIDUE_ALERT) console.log('RESULT: RESIDUE ALERT (see above) — do not treat as an ordinary FAIL.');
else console.log('RESULT: FAIL (see above).');
process.exit(exitCode);
