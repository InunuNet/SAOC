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
//      again, re-revalidate, and verify via BOTH the dataset AND the live page that
//      the sentinel is gone. Cleanup failing is ALSO a hard fail — the script will
//      not exit 0 while the sentinel might still be live on the real site.
//
// Run as: node contracts/checks/f6-prove-cms-loop/check-studio-edit-reaches-site.mjs
// Requires SANITY_API_TOKEN and SANITY_REVALIDATE_SECRET in .env.local, network access
// to the deployed host, and a working Playwright/Chromium install.
// Exit codes: 0 = the sentinel appeared on the live page within the bound, AND cleanup
// was verified. 1 = precondition violated, timeout, unreachable host, auth failure,
// browser launch failure, or cleanup could not be verified — never a skip.

import {
  getSanityClient,
  readDatasetField,
  fetchPublicPageContains,
  callRevalidate,
  openAuthenticatedAboutPageDoc,
  setFieldAndPublish,
  loadEnvOrFail,
  TARGET_DOC_ID,
  TARGET_FIELD,
  TARGET_PAGE_PATH,
} from './_shared.mjs';

// Bound is not arbitrary — @architect polled the live host for 108s straight (10
// attempts, 12s apart) after a real publish + real revalidate call and observed ZERO
// movement (identical CDN cache hit, `age` header climbing monotonically the entire
// time — see contract header). 120s gives a small margin over what was actually
// tested, not an optimistic guess at an untested longer window.
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 10_000;

const revalidateSecret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
const client = getSanityClient();
const nonce = `F6-LOOP-PROOF-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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
    process.exit(1);
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
            'confirmed Studio publish + a 200 response from /api/revalidate. The Studio write and the revalidate call ' +
            'both succeeded in isolation — the site itself did not reflect the change. See the contract header for the ' +
            'live CDN-cache diagnostic evidence (cdn-cache-status: hit, x-nextjs-cache: HIT, monotonically increasing ' +
            "age header) — this looks like Firebase App Hosting's edge cache not being purged by Next's on-demand " +
            'revalidateTag(), a defect independent of anything F4/F5 touched.'
        );
      }
    }
  }
} catch (err) {
  console.error(`FAIL: unexpected error — ${err.stack ?? err.message}`);
} finally {
  if (mutationAttempted) {
    console.log('--- Cleanup: clearing the field and re-publishing (always attempted) ---');
    try {
      // Re-open a fresh Studio session for cleanup in case the original page/browser
      // is in a bad state after a failure above.
      if (browser) await browser.close();
      const reopened = await openAuthenticatedAboutPageDoc();
      browser = reopened.browser;
      await setFieldAndPublish(reopened.page, reopened.field, '');

      const afterCleanupDataset = await readDatasetField(client);
      const datasetClean = afterCleanupDataset == null || String(afterCleanupDataset).trim().length === 0;
      console.log('Dataset after cleanup:', afterCleanupDataset, '| clean:', datasetClean);

      const cleanupRevalidate = await callRevalidate(revalidateSecret, 'aboutPage');
      console.log('Cleanup revalidate response:', cleanupRevalidate);

      const cleanupPropagation = await poll(async () => {
        const r = await fetchPublicPageContains(nonce);
        return { ok: !r.hasNeedle, status: r.status, hasNeedle: r.hasNeedle };
      }, 'cleanup-propagation');

      if (!datasetClean || !cleanupPropagation.ok) {
        console.error(
          'FAIL: cleanup could not be verified — ' +
            (!datasetClean ? `dataset still shows ${JSON.stringify(afterCleanupDataset)}. ` : '') +
            (!cleanupPropagation.ok ? `live page may still show the sentinel after ${POLL_TIMEOUT_MS / 1000}s. ` : '') +
            `MANUAL CHECK REQUIRED: verify ${TARGET_DOC_ID}.${TARGET_FIELD} in the Studio directly.`
        );
        exitCode = 1;
      } else {
        console.log('Cleanup verified: dataset field is empty AND the live page no longer shows the sentinel.');
      }
    } catch (cleanupErr) {
      console.error(
        `FAIL: cleanup threw — ${cleanupErr.stack ?? cleanupErr.message}. ` +
          `MANUAL CHECK REQUIRED: verify ${TARGET_DOC_ID}.${TARGET_FIELD} in the Studio directly and clear it if the sentinel is still there.`
      );
      exitCode = 1;
    }
  }
  if (browser) await browser.close();
}

console.log(exitCode === 0 ? 'PASS: Studio edit reached the live site, and cleanup was verified.' : 'RESULT: FAIL (see above).');
process.exit(exitCode);
