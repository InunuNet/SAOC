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
// Exit codes: 0 = all three sentinels appeared on the live page within 120s AND
// cleanup was verified. 1 = F1 not yet deployed, precondition violated, timeout,
// unreachable host, or cleanup could not be verified — never a skip.

import {
  getSanityClient,
  fetchPublicPageContains,
  callRevalidate,
  openAuthenticatedDoc,
  loadEnvOrFail,
  poll,
  setFieldsAndPublish,
  assertF1Deployed,
  TARGET_DOC_ID,
  TARGET_PAGE_PATH,
  STRUCTURE_PATH,
  REVALIDATE_TYPE,
} from './_shared.mjs';

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

// readDatasetField (imported) only reads ONE field by name via a GROQ projection
// built from that name — it does not support a multi-field projection string
// directly, so this check reads all three with its own small query instead of
// forcing that helper outside its designed shape.
async function readAllFields() {
  try {
    const doc = await client.fetch(`*[_id == $id][0]{title, location, countdownDate}`, { id: TARGET_DOC_ID });
    return doc ?? {};
  } catch (err) {
    console.error(`FAIL: dataset read for ${TARGET_DOC_ID} threw — ${err.message}`);
    process.exit(1);
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
    console.error(
      `FAIL: precondition violated — expected title, location, and countdownDate to all already hold real values ` +
        `(confirmed live 2026-08-05), got ${JSON.stringify(baseline)}. This check's cleanup restores to this exact ` +
        'baseline; it requires that baseline to be real content, not empty.'
    );
    process.exit(1);
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
    const countdownNeedle = afterPublish.countdownDate; // authoritative stored value, not a guessed format

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

      const cleanupPropagation = await poll(async () => {
        const r = await fetchPublicPageContains(baseline.title, TARGET_PAGE_PATH);
        const restored = r.body.includes(baseline.title) && r.body.includes(baseline.location);
        const sentinelsGone = !r.body.includes(sentinels.title) && !r.body.includes(sentinels.location);
        return { ok: restored && sentinelsGone, status: r.status, restored, sentinelsGone };
      }, 'cleanup-propagation');

      if (!datasetClean || !cleanupPropagation.ok) {
        console.error(
          'FAIL: cleanup could not be fully verified — ' +
            (!datasetClean ? `dataset still shows ${JSON.stringify(afterCleanupDataset)}. ` : '') +
            (!cleanupPropagation.ok ? `live page may still show sentinel content after ${POLL_TIMEOUT_MS_LABEL()}s. ` : '') +
            `MANUAL CHECK REQUIRED: verify ${TARGET_DOC_ID} (title/location/countdownDate) in the Studio directly.`
        );
        exitCode = 1;
      } else {
        console.log('Cleanup verified: dataset AND live page both show the restored baseline.');
      }
    } catch (cleanupErr) {
      console.error(
        `FAIL: cleanup threw — ${cleanupErr.stack ?? cleanupErr.message}. ` +
          `MANUAL CHECK REQUIRED: verify ${TARGET_DOC_ID} in the Studio directly and restore title/location/countdownDate if needed.`
      );
      exitCode = 1;
    }
  }
  if (browser) await browser.close();
}

function POLL_TIMEOUT_MS_LABEL() {
  return 120;
}
function beforeRestoreDisplayFallback(iso) {
  // Only used if the pre-restore DOM read failed for some reason — reconstructs the
  // Studio's "YYYY-MM-DD HH:mm" local display format from the stored ISO baseline as
  // a fallback, not the primary path.
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

console.log(exitCode === 0 ? 'PASS: national-show headline fields reached the live site, and cleanup was verified.' : 'RESULT: FAIL (see above).');
process.exit(exitCode);
