#!/usr/bin/env node
// THE CONFIRMATION-MARKER TEST, with the safety device switched off.
//
// WHY THIS EXISTS
// ---------------
// A43 read pendingLabel out of Sanity and looked for it in a page that renders pendingLabel
// from Sanity. Expected value and actual value came from the same place, so the assertion could
// not fail. @qa unset pendingLabel — an unvalidated plain string an editor can clear in two
// seconds — and ALL 23 pending markers vanished from the site while every `confirmations` value
// was still `pending`. A43 stayed green, because clearing the field also emptied the needle and
// textContains short-circuits on `target.length > 0`. See .agent/memory/scratch/visitor-qa.md S2.
//
// The claim under test is not "the label string appears on the page". It is "an unconfirmed
// block is visibly marked, whatever the dataset says". So this check counts markers
// STRUCTURALLY — by the badge's own DOM hook, `[data-confirmation-badge]` — which is derived
// neither from the dataset nor from the label text, and therefore cannot be neutralised by
// emptying a field.
//
// Two phases, one browser:
//   BEFORE — with the labels seeded, every badge's text must be one of the two DATASET labels.
//            That is the "no hardcoded copy" claim, asserted where it is actually observable.
//   AFTER  — with pendingLabel unset, the badge COUNT must be identical and every badge must
//            still carry real text. A safety device must not have an off switch.
//
// MUTATES showVisitorInfo.pendingLabel, under the shared dataset lock, restored with a revision
// guard and verified on the rendered page.
//
// Exit codes: 0 = fails closed. 1 = ordinary failure. 2 = RESIDUE ALERT.

import { chromium } from 'playwright';

import { runCheck, getSanityClient, loadEnvOrFail, callRevalidate, fetchOkPage, visibleText, BASE_URL, PATHS } from './_shared.mjs';
import {
  withDatasetLock,
  assertUsableBaseline,
  commitAndCaptureRev,
  restoreGuarded,
  verifyDatasetRestored,
  residueAlert,
} from './_mutation-guard.mjs';

const DOC_ID = 'showVisitorInfo';
const BADGE_SELECTOR = '[data-confirmation-badge]';
const MARKED_PAGES = [PATHS.landing, PATHS.plan, PATHS.expect, PATHS.faq];
const POLL_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 5_000;
const MIN_LABEL_CHARS = 3;

function normalise(s) {
  return String(s).replace(/[※]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function readBadges(browser, pathname) {
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}${pathname}`, { waitUntil: 'networkidle' });
    const texts = await page.locator(BADGE_SELECTOR).allInnerTexts();
    return texts.map(normalise);
  } finally {
    await page.close();
  }
}

async function pollUntil(predicate, label) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    attempt += 1;
    const result = await predicate();
    console.log(`  [${label}] attempt ${attempt} (t+${Math.round((Date.now() - start) / 1000)}s): ${JSON.stringify(result).slice(0, 200)}`);
    if (result.ok) return { ok: true, attempts: attempt };
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
  return { ok: false, attempts: attempt };
}

await runCheck('check-marker-fail-closed', async (r) => {
  const secret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
  const client = getSanityClient({ withToken: true });

  await withDatasetLock('check-marker-fail-closed', async () => {
    const info = await client.fetch(
      '*[_id == $id][0]{ _rev, pendingLabel, researchLabel, confirmations }',
      { id: DOC_ID },
    );
    if (!info) {
      r.fail('showVisitorInfo singleton exists', 'run scripts/seed-show-visitor-info.ts');
      return;
    }
    assertUsableBaseline('showVisitorInfo.pendingLabel', info.pendingLabel);
    assertUsableBaseline('showVisitorInfo.researchLabel', info.researchLabel);

    const browser = await chromium.launch();
    let mutated = false;
    let mutatedRev = null;

    try {
      // ---- BEFORE ----
      const before = {};
      for (const pathname of MARKED_PAGES) {
        before[pathname] = await readBadges(browser, pathname);
        r.check(
          before[pathname].length > 0,
          `${pathname} carries at least one confirmation badge before the perturbation`,
          `found ${before[pathname].length} — if the badge has no [data-confirmation-badge] hook ` +
            'this check cannot count structurally and must not be made to pass by loosening it',
        );
      }
      const totalBefore = Object.values(before).reduce((n, a) => n + a.length, 0);
      console.log(`  badges before: ${JSON.stringify(Object.fromEntries(MARKED_PAGES.map((p) => [p, before[p].length])))} (total ${totalBefore})`);

      // The "no hardcoded label copy" claim, asserted on the rendered page rather than by
      // grepping the component for today's wording.
      const allowed = new Set([normalise(info.pendingLabel).toLowerCase(), normalise(info.researchLabel).toLowerCase()]);
      const strays = Object.entries(before).flatMap(([p, texts]) =>
        texts.filter((t) => !allowed.has(t.toLowerCase())).map((t) => `${p}: ${JSON.stringify(t.slice(0, 60))}`),
      );
      r.check(
        strays.length === 0,
        'every rendered badge shows one of the two DATASET labels (no label copy frozen into the component)',
        strays.join(' | '),
      );

      // ---- PERTURB: clear the label an editor can clear ----
      mutatedRev = await commitAndCaptureRev(client, DOC_ID, { pendingLabel: '' });
      mutated = true;
      console.log('  cleared showVisitorInfo.pendingLabel');
      const reval = await callRevalidate(secret, DOC_ID);
      r.check(reval.status === 200, '/api/revalidate accepted the invalidation', `status ${reval.status}`);

      const landed = await pollUntil(async () => {
        const { body } = await fetchOkPage(PATHS.plan);
        const gone = !visibleText(body).toLowerCase().includes(normalise(info.pendingLabel).toLowerCase());
        return { ok: gone, datasetLabelGoneFromPage: gone };
      }, 'propagation');

      if (!landed.ok) {
        r.fail(
          `clearing pendingLabel reaches ${PATHS.plan} within ${POLL_TIMEOUT_MS / 1000}s`,
          'cannot evaluate fail-closed behaviour until the perturbation propagates',
        );
        return;
      }

      // ---- AFTER: the markers must still be there ----
      for (const pathname of MARKED_PAGES) {
        const after = await readBadges(browser, pathname);
        r.check(
          after.length === before[pathname].length,
          `${pathname} still shows every confirmation marker with pendingLabel cleared ` +
            `(${before[pathname].length} expected)`,
          `found ${after.length} — clearing one unvalidated string field removed ` +
            `${before[pathname].length - after.length} marker(s) while the statuses are still ` +
            'pending. The page now presents unconfirmed detail as settled fact.',
        );
        const empty = after.filter((t) => t.length < MIN_LABEL_CHARS);
        r.check(
          empty.length === 0,
          `${pathname} badges still carry readable fallback text with pendingLabel cleared`,
          `${empty.length} badge(s) rendered with no usable text`,
        );
      }
    } finally {
      if (mutated) {
        console.log('--- Cleanup: restoring pendingLabel (revision-guarded) ---');
        try {
          await restoreGuarded(client, DOC_ID, { pendingLabel: info.pendingLabel }, mutatedRev);
          const verified = await verifyDatasetRestored(client, DOC_ID, { pendingLabel: info.pendingLabel });
          await callRevalidate(secret, DOC_ID);
          const clean = await pollUntil(async () => {
            const { body } = await fetchOkPage(PATHS.plan);
            const back = visibleText(body).toLowerCase().includes(normalise(info.pendingLabel).toLowerCase());
            return { ok: back, datasetLabelBackOnPage: back };
          }, 'cleanup');
          if (!verified.ok || !clean.ok) {
            residueAlert([
              `document: ${DOC_ID}.pendingLabel`,
              `dataset restored: ${verified.ok}`,
              `rendered page shows the label again: ${clean.ok}`,
              `value to restore: ${JSON.stringify(info.pendingLabel)}`,
            ]);
          } else {
            console.log('Cleanup verified: pendingLabel restored and rendering again.');
          }
        } catch (err) {
          residueAlert([
            `document: ${DOC_ID}.pendingLabel is CLEARED`,
            `restore threw: ${err.message}`,
            'A revision-guard failure means something else wrote to showVisitorInfo during this check.',
            `value to restore: ${JSON.stringify(info.pendingLabel)}`,
          ]);
        }
      }
      await browser.close();
    }
  });
});
