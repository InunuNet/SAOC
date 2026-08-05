#!/usr/bin/env node
// cms-loop-f3-national-show A3: round trip for exhibitorStages (portableText),
// the remaining brief-named inert field NOT covered by A1 or A6. hero is
// deliberately NOT exercised here — per team-lead direction, wiring hero must be
// VISUALLY NEUTRAL (the singleton's hero is corrected to the currently-hardcoded
// asset as part of implementation, then wired as-is; see A6, which proves that
// neutrality statically). Temporarily swapping hero to a different asset here, even
// with guaranteed cleanup, would contradict that "never let a real visitor see a
// different hero image than before wiring" requirement — so this check does not
// touch hero at all.
//
// exhibitorStages is NOT automated via the Studio UI: confirmed live 2026-08-05 that
// title/location/countdownDate render as plain <input type="text"> elements
// automatable with `.fill()` (see A1), but exhibitorStages is a portableText rich
// block editor — disproportionately fragile to drive via Playwright for what this
// needs to prove (that /national-show's render code consumes exhibitorStages from
// nationalShowQuery, not that a secretary can operate the block-editor toolbar).
// This check instead writes directly via the Sanity client (confirmed live
// 2026-08-05 that SANITY_API_TOKEN has write access: a real patch+revert against
// this exact field was performed and verified during contract authoring) — the same
// dataset the Studio writes to, so /api/revalidate and the CDN behave identically to
// a Studio publish.
//
// exhibitorStages starts genuinely empty (confirmed via F4's golden: "GAP. No
// hardcoded exhibitor-stage copy exists... Left unset") — same "start empty" pattern
// F6 used for aboutPage.boardIntroText.
//
// GATED ON F1, same mechanism and reasoning as A1 (assertF1Deployed() in
// _shared.mjs) — refuses to run, before any mutation, unless F1's short-TTL fix is
// confirmed live.
//
// CLEANUP-SAFETY FIX (2026-08-06, same root cause as F6's incident and A1's — see
// f6-prove-cms-loop/_shared.mjs and this contract's own _shared.mjs headers): the
// local readStages() helper and the precondition check below no longer call
// `process.exit(1)` directly (which would silently skip the `finally` cleanup block)
// — both now `throw`. Cleanup's page-level verification now uses verifyLiveAbsence
// (3 consecutive clean reads, 15s apart, up to 5 minutes) instead of a single-shot
// poll, and raises a loud, distinctly-exit-coded, durably-logged residue alert
// (raiseResidueAlert / EXIT_CODE_RESIDUE_ALERT) if it can't confirm removal, instead
// of an ordinary FAIL that could be mistaken for "not wired yet."
//
// Exit codes: 0 = the exhibitorStages sentinel appeared on the live page within 120s
// AND cleanup was verified. 1 = F1 not yet deployed, precondition violated, timeout,
// or unreachable host. EXIT_CODE_RESIDUE_ALERT (2) = mutation succeeded but cleanup
// could not be verified — treat as a live incident, not an ordinary FAIL. Never a
// skip.

import {
  getSanityClient,
  fetchPublicPageContains,
  callRevalidate,
  loadEnvOrFail,
  poll,
  assertF1Deployed,
  verifyLiveAbsence,
  raiseResidueAlert,
  installCrashGuard,
  EXIT_CODE_RESIDUE_ALERT,
  TARGET_DOC_ID,
  TARGET_PAGE_PATH,
  REVALIDATE_TYPE,
} from './_shared.mjs';

installCrashGuard({ check: 'check-exhibitor-stages-round-trip', docId: TARGET_DOC_ID });

await assertF1Deployed();

const revalidateSecret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
const client = getSanityClient();
const nonce = Date.now();
const STAGES_SENTINEL_TEXT = `F3-STAGES-SENTINEL-${nonce}`;

async function readStages() {
  try {
    return await client.fetch(`*[_id == $id][0].exhibitorStages`, { id: TARGET_DOC_ID });
  } catch (err) {
    const msg = `FAIL: dataset read for ${TARGET_DOC_ID}.exhibitorStages threw — ${err.message}`;
    console.error(msg);
    throw new Error(msg);
  }
}

let exitCode = 1;
let mutationAttempted = false;

try {
  console.log('--- Step 1: baseline ---');
  const baseline = await readStages();
  if (baseline != null) {
    const msg =
      `FAIL: precondition violated — exhibitorStages is not empty (${JSON.stringify(baseline)}). ` +
      'This check requires starting from an empty field, per F4\'s golden ("GAP... Left unset").';
    console.error(msg);
    throw new Error(msg);
  }
  console.log('Baseline exhibitorStages:', baseline);

  console.log('--- Step 2: write sentinel exhibitorStages via the Sanity client ---');
  mutationAttempted = true;
  await client
    .patch(TARGET_DOC_ID)
    .set({
      exhibitorStages: [
        { _type: 'block', _key: 'f3sentinel', children: [{ _type: 'span', _key: 'f3sentinelspan', text: STAGES_SENTINEL_TEXT }] },
      ],
    })
    .commit();

  console.log('--- Step 3: confirm the write landed in the dataset ---');
  const afterWrite = await readStages();
  const writeOk = afterWrite?.[0]?.children?.[0]?.text === STAGES_SENTINEL_TEXT;
  if (!writeOk) {
    console.error(`FAIL: sentinel write did not land as expected — dataset shows ${JSON.stringify(afterWrite)}`);
  } else {
    console.log('Write confirmed in dataset.');

    console.log('--- Step 4: call /api/revalidate ---');
    const revalRes = await callRevalidate(revalidateSecret, REVALIDATE_TYPE);
    console.log('revalidate response:', revalRes);
    if (revalRes.status !== 200) {
      console.error(`FAIL: /api/revalidate returned ${revalRes.status}, expected 200`);
    } else {
      console.log('--- Step 5: poll the live public page for the sentinel ---');
      const propagation = await poll(async () => {
        const r = await fetchPublicPageContains(STAGES_SENTINEL_TEXT, TARGET_PAGE_PATH);
        return { ok: r.hasNeedle, status: r.status, hasNeedle: r.hasNeedle };
      }, 'propagation');

      if (propagation.ok) {
        console.log(`PASS (propagation): exhibitorStages sentinel appeared after ${propagation.attempts} attempt(s).`);
        exitCode = 0;
      } else {
        console.error(
          `FAIL (propagation): exhibitorStages sentinel never appeared on ${TARGET_PAGE_PATH} within 120s of a ` +
            'confirmed dataset write + a 200 revalidate response, even though F1 is confirmed deployed (the guard above ' +
            'passed) — this means /national-show is not rendering nationalShow.exhibitorStages.'
        );
      }
    }
  }
} catch (err) {
  console.error(`FAIL: unexpected error — ${err.stack ?? err.message}`);
} finally {
  if (mutationAttempted) {
    console.log('--- Cleanup: clearing exhibitorStages back to empty (always attempted) ---');
    try {
      await client.patch(TARGET_DOC_ID).unset(['exhibitorStages']).commit();

      const afterCleanup = await readStages();
      const datasetClean = afterCleanup == null;
      console.log('Dataset after cleanup:', JSON.stringify(afterCleanup), '| clean:', datasetClean);

      const cleanupRevalidate = await callRevalidate(revalidateSecret, REVALIDATE_TYPE);
      console.log('Cleanup revalidate response:', cleanupRevalidate);

      // 3 consecutive clean reads, 15s apart, up to 5 minutes — see file header and
      // f6-prove-cms-loop/_shared.mjs. Deliberately separate from, and slower than,
      // the 120s propagation-poll bound above.
      const cleanupPropagation = await verifyLiveAbsence(STAGES_SENTINEL_TEXT, TARGET_PAGE_PATH, { label: 'cleanup-propagation' });

      if (!datasetClean || !cleanupPropagation.ok) {
        raiseResidueAlert({
          checkName: 'cms-loop-f3-national-show/check-exhibitor-stages-round-trip',
          docId: TARGET_DOC_ID,
          field: 'exhibitorStages',
          expectedValue: null,
          sentinelValue: STAGES_SENTINEL_TEXT,
          pagePath: TARGET_PAGE_PATH,
          extra: !datasetClean ? `dataset still shows ${JSON.stringify(afterCleanup)}` : 'dataset confirmed clean; live page could not confirm sentinel absence within the sustained-check window',
        });
        // Set the exit code rather than calling process.exit() here directly — this
        // is still inside the outer finally block; nothing further needs to run below
        // in this script, but the pattern is kept consistent with A1 deliberately.
        exitCode = EXIT_CODE_RESIDUE_ALERT;
      } else {
        console.log('Cleanup verified: dataset AND live page both confirm the restored (empty) baseline.');
      }
    } catch (cleanupErr) {
      raiseResidueAlert({
        checkName: 'cms-loop-f3-national-show/check-exhibitor-stages-round-trip',
        docId: TARGET_DOC_ID,
        field: 'exhibitorStages',
        expectedValue: null,
        sentinelValue: STAGES_SENTINEL_TEXT,
        pagePath: TARGET_PAGE_PATH,
        extra: `cleanup threw: ${cleanupErr.stack ?? cleanupErr.message}`,
      });
      exitCode = EXIT_CODE_RESIDUE_ALERT;
    }
  }
}

if (exitCode === 0) {
  console.log('PASS: exhibitorStages reached the live site, and cleanup was verified.');
} else if (exitCode === EXIT_CODE_RESIDUE_ALERT) {
  console.log('RESULT: RESIDUE ALERT (see banner above) — treat as a live incident, not an ordinary FAIL.');
} else {
  console.log('RESULT: FAIL (see above).');
}
process.exit(exitCode);
