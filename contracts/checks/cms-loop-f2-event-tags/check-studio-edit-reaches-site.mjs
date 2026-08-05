#!/usr/bin/env node
// F2 (cms-loop-and-wiring): the headline assertion for the /events/[slug]
// revalidation-tag fix. Structurally identical to F6's
// check-studio-edit-reaches-site.mjs — same six steps, same cleanup discipline, same
// hard-fail-on-timeout rule — retargeted at a real societyEvent document and its real
// _type ('societyEvent'), which is exactly the mismatch this feature fixes ('events'
// matches neither 'sanity' nor 'societyEvent').
//   1. Baseline: read the target field from the live dataset AND the live public page
//      — must be empty/absent on both, or the test's own precondition is violated.
//   2. Open the deployed Studio (authenticated via localStorage token injection),
//      type a unique sentinel value into the target societyEvent's `description`
//      field, click Publish.
//   3. Confirm the publish landed in the dataset (authoritative Content Lake read).
//   4. Call POST /api/revalidate with the correct secret and `_type: 'societyEvent'`
//      — the same call a configured Sanity webhook fires for a real event edit.
//   5. Poll the LIVE PUBLIC /events/<slug> PAGE (never the Studio, never the dataset
//      API) for the sentinel string in the rendered HTML, bounded at 120s / 10s
//      intervals — identical bound to F6's A1, not lengthened. A timeout is a HARD
//      FAIL, not inconclusive.
//   6. ALWAYS (even after a failure above) attempt cleanup: clear the field, publish
//      again, re-revalidate, and verify via BOTH the dataset AND the live page that
//      the sentinel is gone. Cleanup failing is ALSO a hard fail.
//
// EXPECTED RESULT TODAY: FAIL. Two independent, layered reasons, both real:
//   (a) Pre-fix, app/(marketing)/events/[slug]/page.tsx tags its sanityFetch calls
//       ['events'] — this doesn't match 'societyEvent' (nor 'sanity'), so step 4's
//       revalidateTag('societyEvent', ...) call currently invalidates nothing this
//       page depends on. This is what F2 fixes.
//   (b) Independently, per docs/f6-cdn-invalidation-investigation.md, Firebase App
//       Hosting's CDN edge does not re-check origin on revalidateTag() alone — the
//       CDN purge gap F1 (this same mission) is responsible for closing. Even after
//       F2's tag fix lands, this check will still fail until F1 also lands, because
//       both fixes sit on the same request path. This is expected and correct — do
//       not weaken this check, lengthen its bound, or pick an easier target to
//       manufacture a green result before both F1 and F2 are actually done.
//
// Run as: node contracts/checks/cms-loop-f2-event-tags/check-studio-edit-reaches-site.mjs
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
  openAuthenticatedDoc,
  setFieldAndPublish,
  loadEnvOrFail,
  verifyLiveAbsence,
  raiseResidueAlert,
  installCrashGuard,
  EXIT_CODE_RESIDUE_ALERT,
} from '../f6-prove-cms-loop/_shared.mjs';
import {
  TARGET_EVENT_DOC_ID,
  TARGET_EVENT_FIELD,
  TARGET_EVENT_PAGE_PATH,
  TARGET_EVENT_TYPE,
  TARGET_EVENT_STRUCTURE_PATH,
} from './_event-target.mjs';

// Identical bound to F6's A1 — this is not a fresh, untested number; it is the same
// 120s/10s bound already validated against this exact CDN behaviour. Do not lengthen
// it to try to manufacture a pass. This is the PROPAGATION bound (proves the feature
// works) — deliberately separate from cleanup verification's own, more conservative
// safety-net bound (see _shared.mjs's verifyLiveAbsence, added 2026-08-06 after a
// real cleanup-failure incident on F6's A1 — see that file's header).
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 10_000;

const nonce = `F2-EVENT-LOOP-PROOF-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
installCrashGuard({ checkName: 'f2-check-studio-edit-reaches-site', docId: TARGET_EVENT_DOC_ID, field: TARGET_EVENT_FIELD, sentinelValue: nonce, pagePath: TARGET_EVENT_PAGE_PATH });

const revalidateSecret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
const client = getSanityClient();
console.log(`Sentinel value: ${nonce}`);
console.log(`Target: ${TARGET_EVENT_DOC_ID}.${TARGET_EVENT_FIELD}, public page ${TARGET_EVENT_PAGE_PATH}, revalidate type ${TARGET_EVENT_TYPE}`);

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
  console.log('--- Step 1: baseline ---');
  const baselineField = await readDatasetField(client, TARGET_EVENT_DOC_ID, TARGET_EVENT_FIELD);
  if (baselineField != null && String(baselineField).trim().length > 0) {
    console.error(
      `FAIL: precondition violated — ${TARGET_EVENT_DOC_ID}.${TARGET_EVENT_FIELD} is not empty ` +
        `(${JSON.stringify(baselineField)}). This check requires starting from an empty field so the ` +
        'sentinel and the restore are unambiguous. Do not run this against an event with real ' +
        'description content already set.'
    );
    process.exit(1);
  }
  const baselinePage = await fetchPublicPageContains(nonce, TARGET_EVENT_PAGE_PATH);
  console.log('Baseline dataset field:', baselineField, '| baseline page:', baselinePage);

  console.log('--- Step 2: open Studio, edit, publish ---');
  const opened = await openAuthenticatedDoc(TARGET_EVENT_DOC_ID, TARGET_EVENT_FIELD, TARGET_EVENT_STRUCTURE_PATH);
  browser = opened.browser;
  mutationAttempted = true;
  await setFieldAndPublish(opened.page, opened.field, nonce);

  console.log('--- Step 3: confirm publish landed in the dataset ---');
  const afterPublish = await readDatasetField(client, TARGET_EVENT_DOC_ID, TARGET_EVENT_FIELD);
  if (afterPublish !== nonce) {
    console.error(`FAIL: Studio publish did not land — dataset shows ${JSON.stringify(afterPublish)}, expected ${JSON.stringify(nonce)}`);
    // fall through to cleanup in finally; exitCode stays 1
  } else {
    console.log('Publish confirmed in dataset.');

    console.log('--- Step 4: call /api/revalidate ---');
    const revalRes = await callRevalidate(revalidateSecret, TARGET_EVENT_TYPE);
    console.log('revalidate response:', revalRes);
    if (revalRes.status !== 200) {
      console.error(`FAIL: /api/revalidate returned ${revalRes.status}, expected 200 — cannot proceed to the propagation check`);
    } else {
      console.log('--- Step 5: poll the live public page for the sentinel ---');
      const propagation = await poll(async () => {
        const r = await fetchPublicPageContains(nonce, TARGET_EVENT_PAGE_PATH);
        return { ok: r.hasNeedle, status: r.status, hasNeedle: r.hasNeedle };
      }, 'propagation');

      if (propagation.ok) {
        console.log(`PASS (propagation): sentinel appeared on the live page after ${propagation.attempts} attempt(s).`);
        exitCode = 0;
      } else {
        console.error(
          `FAIL (propagation): sentinel never appeared on ${TARGET_EVENT_PAGE_PATH} within ${POLL_TIMEOUT_MS / 1000}s of a ` +
            'confirmed Studio publish + a 200 response from /api/revalidate. See this script\'s header comment for the ' +
            'two layered, independent reasons this is expected until BOTH F1 (CDN purge) and F2 (this fix) have landed.'
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
      const reopened = await openAuthenticatedDoc(TARGET_EVENT_DOC_ID, TARGET_EVENT_FIELD, TARGET_EVENT_STRUCTURE_PATH);
      browser = reopened.browser;
      await setFieldAndPublish(reopened.page, reopened.field, '');

      afterCleanupDataset = await readDatasetField(client, TARGET_EVENT_DOC_ID, TARGET_EVENT_FIELD);
      const datasetClean = afterCleanupDataset == null || String(afterCleanupDataset).trim().length === 0;
      console.log('Dataset after cleanup:', afterCleanupDataset, '| clean:', datasetClean);

      const cleanupRevalidate = await callRevalidate(revalidateSecret, TARGET_EVENT_TYPE);
      console.log('Cleanup revalidate response:', cleanupRevalidate);

      console.log('--- Verifying live-page absence (requires 3 consecutive clean reads, up to 5 min) ---');
      const cleanupPropagation = await verifyLiveAbsence(nonce, TARGET_EVENT_PAGE_PATH);

      cleanupOk = datasetClean && cleanupPropagation.ok;
      if (!cleanupOk) {
        console.error(
          'FAIL: cleanup could not be verified — ' +
            (!datasetClean ? `dataset still shows ${JSON.stringify(afterCleanupDataset)}. ` : '') +
            (!cleanupPropagation.ok ? 'live page did not reach 3 consecutive clean reads within the safety-net window. ' : '')
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
        checkName: 'f2-check-studio-edit-reaches-site',
        docId: TARGET_EVENT_DOC_ID,
        field: TARGET_EVENT_FIELD,
        expectedValue: '',
        sentinelValue: nonce,
        pagePath: TARGET_EVENT_PAGE_PATH,
        extra: `Dataset value observed at cleanup time: ${JSON.stringify(afterCleanupDataset)}`,
      });
      exitCode = EXIT_CODE_RESIDUE_ALERT;
    }
  }
  if (browser) await browser.close();
}

if (exitCode === 0) console.log('PASS: Studio edit reached the live event page, and cleanup was verified.');
else if (exitCode === EXIT_CODE_RESIDUE_ALERT) console.log('RESULT: RESIDUE ALERT (see above) — do not treat as an ordinary FAIL.');
else console.log('RESULT: FAIL (see above).');
process.exit(exitCode);
