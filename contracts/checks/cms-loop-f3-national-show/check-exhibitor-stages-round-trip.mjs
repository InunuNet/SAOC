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
// Exit codes: 0 = the exhibitorStages sentinel appeared on the live page within 120s
// AND cleanup (cleared back to empty) was verified via both the dataset and the live
// page. 1 = F1 not yet deployed, precondition violated, timeout, unreachable host, or
// cleanup could not be verified — never a skip.

import {
  getSanityClient,
  fetchPublicPageContains,
  callRevalidate,
  loadEnvOrFail,
  poll,
  assertF1Deployed,
  TARGET_DOC_ID,
  TARGET_PAGE_PATH,
  REVALIDATE_TYPE,
} from './_shared.mjs';

await assertF1Deployed();

const revalidateSecret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
const client = getSanityClient();
const nonce = Date.now();
const STAGES_SENTINEL_TEXT = `F3-STAGES-SENTINEL-${nonce}`;

async function readStages() {
  try {
    return await client.fetch(`*[_id == $id][0].exhibitorStages`, { id: TARGET_DOC_ID });
  } catch (err) {
    console.error(`FAIL: dataset read for ${TARGET_DOC_ID}.exhibitorStages threw — ${err.message}`);
    process.exit(1);
  }
}

let exitCode = 1;
let mutationAttempted = false;

try {
  console.log('--- Step 1: baseline ---');
  const baseline = await readStages();
  if (baseline != null) {
    console.error(
      `FAIL: precondition violated — exhibitorStages is not empty (${JSON.stringify(baseline)}). ` +
        'This check requires starting from an empty field, per F4\'s golden ("GAP... Left unset").'
    );
    process.exit(1);
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

      const cleanupPropagation = await poll(async () => {
        const r = await fetchPublicPageContains(STAGES_SENTINEL_TEXT, TARGET_PAGE_PATH);
        return { ok: !r.hasNeedle, status: r.status, hasNeedle: r.hasNeedle };
      }, 'cleanup-propagation');

      if (!datasetClean || !cleanupPropagation.ok) {
        console.error(
          'FAIL: cleanup could not be fully verified — ' +
            (!datasetClean ? `dataset still shows ${JSON.stringify(afterCleanup)}. ` : '') +
            (!cleanupPropagation.ok ? 'live page may still show the exhibitorStages sentinel after 120s. ' : '') +
            `MANUAL CHECK REQUIRED: verify ${TARGET_DOC_ID}.exhibitorStages in the Studio directly.`
        );
        exitCode = 1;
      } else {
        console.log('Cleanup verified: dataset AND live page both show the restored (empty) baseline.');
      }
    } catch (cleanupErr) {
      console.error(
        `FAIL: cleanup threw — ${cleanupErr.stack ?? cleanupErr.message}. ` +
          `MANUAL CHECK REQUIRED: verify ${TARGET_DOC_ID}.exhibitorStages in the Studio directly and clear it if needed.`
      );
      exitCode = 1;
    }
  }
}

console.log(exitCode === 0 ? 'PASS: exhibitorStages reached the live site, and cleanup was verified.' : 'RESULT: FAIL (see above).');
process.exit(exitCode);
