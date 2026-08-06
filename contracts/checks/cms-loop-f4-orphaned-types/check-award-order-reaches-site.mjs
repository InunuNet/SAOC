#!/usr/bin/env node
// F4 (cms-loop-and-wiring): A2 — the curated-order round trip. Proves the "curated
// display order (AM, FCC, HCC, CCM, CBR, JC) renders in the specified sequence" claim
// DYNAMICALLY — by temporarily moving award-am-saoc from first to last via a real
// Studio publish and observing the live page's rendered sequence actually change —
// not by asserting the six codes exist in the right order once, which the CURRENT,
// unwired static `lib/data/awards` import already renders correctly today (see
// contract header "WHY A STATIC ORDER CHECK ALONE PROVES NOTHING"). Detection logic
// (isRenderedLast/isRenderedFirst) is unit-tested standalone by
// check-order-detector-selftest.mjs (A4) — run that first if this fails, to rule out
// a broken detector before trusting this check's negative result.
//
//   1. Baseline: dataset `order` MUST equal AWARD_AM_ORDER_VALUE (1) exactly, AND the
//      live page must currently render AM/SAOC first among the six codes. Either
//      failing is a hard FAIL precondition violation (see script for which).
//   2. Open the deployed Studio, set `order` to AWARD_ORDER_SENTINEL_VALUE (99, moves
//      AM/SAOC to render last), publish.
//   3. Confirm the publish landed in the dataset.
//   4. Call POST /api/revalidate with `_type: 'award'`.
//   5. Poll the LIVE PUBLIC /judging page: is AM/SAOC now rendered LAST among the six
//      codes? Bounded 120s / 10s, hard FAIL on timeout.
//   6. ALWAYS attempt cleanup: restore `order` to AWARD_AM_ORDER_VALUE, re-publish,
//      re-revalidate, verify via BOTH the dataset AND the live page that AM/SAOC is
//      no longer rendered last (i.e. the abnormal state is gone). Cleanup failing is
//      a hard FAIL.
//
// EXPECTED RESULT TODAY: FAIL at the PRECONDITION step — `order` does not exist on
// the `award` schema at all yet (confirmed live, 2026-08-05). Once @dev adds the
// field and backfills the curated sequence, the precondition will pass; propagation
// will still fail until F1 (CDN purge) also lands — same layered dependency as A1
// and F2's A1. Do not weaken, lengthen, or retarget this check to manufacture a pass.
//
// Run as: node contracts/checks/cms-loop-f4-orphaned-types/check-award-order-reaches-site.mjs
// Exit codes: 0 = order change observed live AND cleanup verified. 1 = precondition
// violated, timeout, unreachable host, auth failure, field not found, or cleanup
// could not be verified — never a skip.

import {
  getSanityClient,
  readDatasetField,
  fetchPublicPageContains,
  callRevalidate,
  openAuthenticatedDoc,
  setFieldAndPublish,
  loadEnvOrFail,
  verifySustainedCondition,
  raiseResidueAlert,
  installCrashGuard,
  announceRuntimeExpectations,
  announceCleanupPhase,
  EXIT_CODE_RESIDUE_ALERT,
  BASE_URL,
} from '../f6-prove-cms-loop/_shared.mjs';
import {
  AWARD_DOC_ID,
  AWARD_STRUCTURE_PATH,
  AWARD_PAGE_PATH,
  AWARD_REVALIDATE_TYPE,
  AWARD_ORDER_FIELD,
  AWARD_AM_ORDER_VALUE,
  AWARD_ORDER_SENTINEL_VALUE,
  CURATED_AWARD_CODES,
} from './_award-target.mjs';
import { isRenderedFirst, isRenderedLast } from './_order-detect.mjs';

// PROPAGATION bound (proves the feature works) — separate from cleanup verification's
// own, more conservative safety-net bound (_shared.mjs's verifySustainedCondition,
// added 2026-08-06 after a real cleanup-failure incident on F6's A1).
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 10_000;
const AM_CODE = 'AM/SAOC';

installCrashGuard({ checkName: 'f4-check-award-order-reaches-site', docId: AWARD_DOC_ID, field: AWARD_ORDER_FIELD, sentinelValue: String(AWARD_ORDER_SENTINEL_VALUE), pagePath: AWARD_PAGE_PATH });

const revalidateSecret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
const client = getSanityClient();
announceRuntimeExpectations('f4-check-award-order-reaches-site');
console.log(`Target: ${AWARD_DOC_ID}.${AWARD_ORDER_FIELD}, public page ${AWARD_PAGE_PATH}, revalidate type ${AWARD_REVALIDATE_TYPE}`);

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

async function fetchJudgingHtml() {
  const r = await fetchPublicPageContains('__never_matches__', AWARD_PAGE_PATH);
  return r.body;
}

let browser;
let mutationAttempted = false;
// 0 = full pass, 1 = ordinary fail (no residue), 2 = residue alert.
let exitCode = 1;

try {
  console.log('--- Step 1: baseline (dataset order AND live rendered position) ---');
  const baselineOrder = await readDatasetField(client, AWARD_DOC_ID, AWARD_ORDER_FIELD);
  if (baselineOrder !== AWARD_AM_ORDER_VALUE) {
    console.error(
      `FAIL: precondition violated — ${AWARD_DOC_ID}.${AWARD_ORDER_FIELD} is ${JSON.stringify(baselineOrder)}, ` +
        `expected exactly ${AWARD_AM_ORDER_VALUE}. Expected before @dev adds the \`order\` field to ` +
        'sanity/schemas/documents/award.ts and backfills the curated sequence — see contract header ' +
        '"EXPECTED PRE-FIX RESULTS". Not a propagation failure; the round trip never started.'
    );
    process.exit(1);
  }
  const baselineHtml = await fetchJudgingHtml();
  const baselineFirst = isRenderedFirst(baselineHtml, AM_CODE, CURATED_AWARD_CODES);
  console.log('Baseline dataset order:', baselineOrder, '| AM/SAOC currently renders first:', baselineFirst);
  if (!baselineFirst) {
    console.error(
      `FAIL: precondition violated — ${AM_CODE} does not currently render first on ${AWARD_PAGE_PATH} among ` +
        `${JSON.stringify(CURATED_AWARD_CODES)}. Either the page is not rendering all six codes, or the curated ` +
        'order is not yet correct — cannot proceed with a mutation whose "reverted" success criteria assumes this baseline.'
    );
    process.exit(1);
  }

  console.log('--- Step 2: open Studio, edit, publish ---');
  const opened = await openAuthenticatedDoc(AWARD_DOC_ID, AWARD_ORDER_FIELD, AWARD_STRUCTURE_PATH);
  browser = opened.browser;
  mutationAttempted = true;
  await setFieldAndPublish(opened.page, opened.field, String(AWARD_ORDER_SENTINEL_VALUE));

  console.log('--- Step 3: confirm publish landed in the dataset ---');
  const afterPublish = await readDatasetField(client, AWARD_DOC_ID, AWARD_ORDER_FIELD);
  if (afterPublish !== AWARD_ORDER_SENTINEL_VALUE) {
    console.error(`FAIL: Studio publish did not land — dataset shows ${JSON.stringify(afterPublish)}, expected ${AWARD_ORDER_SENTINEL_VALUE}`);
  } else {
    console.log('Publish confirmed in dataset.');

    console.log('--- Step 4: call /api/revalidate ---');
    const revalRes = await callRevalidate(revalidateSecret, AWARD_REVALIDATE_TYPE);
    console.log('revalidate response:', revalRes);
    if (revalRes.status !== 200) {
      console.error(`FAIL: /api/revalidate returned ${revalRes.status}, expected 200 — cannot proceed to the propagation check`);
    } else {
      console.log('--- Step 5: poll the live public page for AM/SAOC rendering last ---');
      const propagation = await poll(async () => {
        const html = await fetchJudgingHtml();
        const last = isRenderedLast(html, AM_CODE, CURATED_AWARD_CODES);
        return { ok: last, amIsLast: last };
      }, 'propagation');

      if (propagation.ok) {
        console.log(`PASS (propagation): ${AM_CODE} rendered last on the live page after ${propagation.attempts} attempt(s).`);
        exitCode = 0;
      } else {
        console.error(
          `FAIL (propagation): ${AM_CODE} never rendered last on ${AWARD_PAGE_PATH} within ${POLL_TIMEOUT_MS / 1000}s of ` +
            'a confirmed Studio publish + a 200 response from /api/revalidate. Expected until F1 (CDN purge) has landed.'
        );
      }
    }
  }
} catch (err) {
  console.error(`FAIL: unexpected error — ${err.stack ?? err.message}`);
} finally {
  if (mutationAttempted) {
    announceCleanupPhase();
    console.log('--- Cleanup: restoring the original order and re-publishing (always attempted) ---');
    let cleanupOk = false;
    let afterCleanupDataset;
    try {
      if (browser) await browser.close();
      const reopened = await openAuthenticatedDoc(AWARD_DOC_ID, AWARD_ORDER_FIELD, AWARD_STRUCTURE_PATH);
      browser = reopened.browser;
      await setFieldAndPublish(reopened.page, reopened.field, String(AWARD_AM_ORDER_VALUE));

      afterCleanupDataset = await readDatasetField(client, AWARD_DOC_ID, AWARD_ORDER_FIELD);
      const datasetClean = afterCleanupDataset === AWARD_AM_ORDER_VALUE;
      console.log('Dataset after cleanup:', afterCleanupDataset, '| restored to expected value:', datasetClean);

      const cleanupRevalidate = await callRevalidate(revalidateSecret, AWARD_REVALIDATE_TYPE);
      console.log('Cleanup revalidate response:', cleanupRevalidate);

      console.log('--- Verifying AM/SAOC no longer renders last (requires 3 consecutive clean reads, up to 5 min) ---');
      const cleanupPropagation = await verifySustainedCondition(async () => {
        const html = await fetchJudgingHtml();
        return !isRenderedLast(html, AM_CODE, CURATED_AWARD_CODES);
      }, { label: 'cleanup-verify' });

      cleanupOk = datasetClean && cleanupPropagation.ok;
      if (!cleanupOk) {
        console.error(
          'FAIL: cleanup could not be verified — ' +
            (!datasetClean ? `dataset shows ${JSON.stringify(afterCleanupDataset)}, expected ${AWARD_AM_ORDER_VALUE}. ` : '') +
            (!cleanupPropagation.ok ? `live page may still render ${AM_CODE} last within the safety-net window. ` : '')
        );
      } else {
        console.log('Cleanup verified: dataset order restored AND the live page sustained AM/SAOC not-last.');
      }
    } catch (cleanupErr) {
      console.error(`Cleanup threw — ${cleanupErr.stack ?? cleanupErr.message}`);
      cleanupOk = false;
    }

    if (!cleanupOk) {
      raiseResidueAlert({
        checkName: 'f4-check-award-order-reaches-site',
        docId: AWARD_DOC_ID,
        field: AWARD_ORDER_FIELD,
        expectedValue: AWARD_AM_ORDER_VALUE,
        sentinelValue: String(AWARD_ORDER_SENTINEL_VALUE),
        pagePath: AWARD_PAGE_PATH,
        extra: `Dataset value observed at cleanup time: ${JSON.stringify(afterCleanupDataset)}`,
      });
      exitCode = EXIT_CODE_RESIDUE_ALERT;
    }
  }
  if (browser) await browser.close();
}

if (exitCode === 0) console.log('PASS: curated order change reached the live judging page, and cleanup was verified.');
else if (exitCode === EXIT_CODE_RESIDUE_ALERT) console.log('RESULT: RESIDUE ALERT (see above) — do not treat as an ordinary FAIL.');
else console.log('RESULT: FAIL (see above).');
console.log(`(BASE_URL was ${BASE_URL})`);
process.exit(exitCode);
