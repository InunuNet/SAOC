#!/usr/bin/env node
// The mission's central posture, asserted over real HTTP: nothing on these pages may read as
// committee-confirmed fact while its status is pending or research.
//
// The label needles are read from the dataset, so rewording pendingLabel in Studio changes
// what this check looks for. A label hardcoded in a component would pass a naive grep and
// fail the moment an editor tried to reword it — which is the bug being prevented.
//
// See contracts/golden/show-visitor-info/confirmation-status-model.golden.md.

import { runCheck, getSanityClient, settlePage, visibleText, textContains, PATHS } from './_shared.mjs';
import { withDatasetLock } from './_mutation-guard.mjs';
import { assertUsableNeedle } from './_mutation-guard.mjs';

// Which confirmation block belongs to which page — used to work out how many markers each
// page must carry, from the dataset's own statuses rather than from a fixed number here.
const BLOCKS_BY_PAGE = {
  [PATHS.plan]: ['venue', 'parking', 'publicTransport', 'accommodation', 'attractions', 'emergencyContacts'],
  [PATHS.expect]: ['dates', 'openingHours', 'admission', 'accessibility', 'photography', 'cloakroom', 'food'],
};

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!n) return 0;
  let count = 0;
  let idx = h.indexOf(n);
  while (idx !== -1) {
    count += 1;
    idx = h.indexOf(n, idx + n.length);
  }
  return count;
}

await runCheck('check-confirmation-markers', async (r) => {
  // READ LOCK. This check reads the dataset and asserts the page agrees with it, so it must not
  // observe a dataset that a mutating check has deliberately invalidated mid-flight — the sweep
  // unsets countdownDate for minutes, and no amount of polling converges on that. Waits 240s
  // (readers are cheap to retry); the assertion's timeout_seconds covers wait + runtime.
  await withDatasetLock('check-confirmation-markers (read)', async () => {
    const client = getSanityClient();
    let info = await client.fetch(
      '*[_id == "showVisitorInfo"][0]{ pendingLabel, researchLabel, confirmations }',
    );

    if (!info) {
      r.fail('showVisitorInfo singleton exists', 'run scripts/seed-show-visitor-info.ts');
      return;
    }

    // NEEDLE DISCIPLINE. Every count below uses these two strings as its needle, so a blank one
    // makes every downstream assertion vacuously true — that is precisely how this check stayed
    // green while @qa's unset of pendingLabel removed all 23 markers from the site. An unusable
    // needle is a hard failure of the check, never a silently skipped assertion.
    const labelsUsable =
      assertUsableNeedle(r, 'showVisitorInfo.pendingLabel', info.pendingLabel) &
      assertUsableNeedle(r, 'showVisitorInfo.researchLabel', info.researchLabel);
    if (!labelsUsable) {
      r.fail(
        'confirmation labels are usable needles',
        'refusing to evaluate marker counts against a blank needle — see check-marker-fail-closed.mjs',
      );
      return;
    }

    r.check(
      info.confirmations && typeof info.confirmations === 'object',
      'showVisitorInfo.confirmations is seeded',
    );

    const confirmations = info.confirmations ?? {};

    // settlePage: the label needles come from the dataset, so a single fetch races any writer.
    for (const [pathname, blocks] of Object.entries(BLOCKS_BY_PAGE)) {
      const body = await settlePage(pathname, async () => {
        info = await client.fetch(
          '*[_id == "showVisitorInfo"][0]{ pendingLabel, researchLabel, confirmations }',
        );
        return [info?.pendingLabel];
      });
      const text = visibleText(body);

      const expectedPending = blocks.filter((b) => (confirmations[b] ?? 'pending') === 'pending').length;
      const expectedResearch = blocks.filter((b) => confirmations[b] === 'research').length;

      const actualPending = countOccurrences(text, info.pendingLabel);
      const actualResearch = countOccurrences(text, info.researchLabel);

      r.check(
        expectedPending === 0 || actualPending >= 1,
        `${pathname} shows the pending label (${expectedPending} block(s) are pending)`,
      );
      r.check(
        actualPending >= expectedPending,
        `${pathname} shows one pending marker per pending block`,
        `expected at least ${expectedPending}, found ${actualPending}`,
      );
      r.check(
        actualResearch >= expectedResearch,
        `${pathname} shows one research marker per research block`,
        `expected at least ${expectedResearch}, found ${actualResearch}`,
      );
    }

    // Per-FAQ status markers.
    const faqs = await client.fetch(
      '*[_type == "showFaq" && active == true]{ question, status }',
    );
    const faqBody = await settlePage(PATHS.faq, async () => {
      info = await client.fetch('*[_id == "showVisitorInfo"][0]{ pendingLabel, researchLabel, confirmations }');
      return [info?.pendingLabel];
    });
    const faqText = visibleText(faqBody);

    r.check(Array.isArray(faqs) && faqs.length > 0, 'showFaq documents are seeded');

    const pendingFaqs = (faqs ?? []).filter((f) => (f.status ?? 'pending') === 'pending').length;
    r.check(
      pendingFaqs === 0 || countOccurrences(faqText, info.pendingLabel) >= pendingFaqs,
      `${PATHS.faq} marks every pending answer`,
      `${pendingFaqs} pending FAQ(s), ${countOccurrences(faqText, info.pendingLabel)} marker(s) on the page`,
    );

    // ---- Fail-closed, at source level ----
    //
    // The old assertion here was `!/'(To be confirmed|Researched by)/` — "the component hardcodes
    // no label text". It was the wrong shape twice over: it froze today's wording into the check,
    // and it actively FORBADE the built-in fallback that stops the badge disappearing when an
    // editor clears the field. The "labels come from Sanity" claim is now asserted where it is
    // observable, on the rendered page, by check-marker-fail-closed.mjs.
    //
    // What a grep CAN settle is the shape of the control flow: the badge may return null for a
    // confirmed block and for nothing else. An early return on a falsy label is the S2 defect.
    const { readFileSync } = await import('node:fs');
    const badge = readFileSync('components/show/ConfirmationBadge.tsx', 'utf8');
    r.check(
      /'confirmed'/.test(badge),
      'ConfirmationBadge branches explicitly on the confirmed status',
    );

    const nullReturns = badge.match(/return\s+null/g) ?? [];
    r.check(
      nullReturns.length === 1,
      'ConfirmationBadge has exactly one `return null` — the confirmed branch, and nothing else',
      `found ${nullReturns.length}; a second one is how the badge came to vanish for an empty label`,
    );
    r.check(
      /if\s*\(\s*status\s*===\s*'confirmed'\s*\)\s*return\s+null/.test(badge),
      'the single `return null` is guarded by status === \'confirmed\'',
    );
    r.check(
      !/if\s*\(\s*!\s*label\s*\)\s*return\s+null/.test(badge),
      'ConfirmationBadge does not bail out on an empty label (a safety device has no off switch)',
    );
    r.check(
      /data-confirmation-badge/.test(badge),
      'ConfirmationBadge carries the [data-confirmation-badge] hook that lets markers be counted ' +
        'structurally rather than by their own text',
    );
    r.check(
      textContains(badge, 'FALLBACK_PENDING_LABEL') && textContains(badge, 'FALLBACK_RESEARCH_LABEL'),
      'ConfirmationBadge defines built-in fallback labels for when the Sanity props are empty',
    );
  }, { waitTimeoutMs: 240_000 });
});
