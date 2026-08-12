#!/usr/bin/env node
// F4: the FAQ page is driven by showFaq documents, grouped by category and ordered — proven
// against the rendered HTML, in document order, not by grepping the source for "category".
//
// Every active FAQ's question must appear on the page, the questions within a category must
// appear in `order` sequence, and the categories must appear in the fixed presentation order
// from showFaq-schema.golden.json. An inactive FAQ must NOT appear.

import { runCheck, getSanityClient, settlePage, visibleText, linksTo, PATHS } from './_shared.mjs';
import { withDatasetLock } from './_mutation-guard.mjs';

const CATEGORY_ORDER = ['getting-there', 'tickets', 'accessibility', 'plant-sales', 'general'];

await runCheck('check-faq-grouping', async (r) => {
  // READ LOCK. This check reads the dataset and asserts the page agrees with it, so it must not
  // observe a dataset that a mutating check has deliberately invalidated mid-flight — the sweep
  // unsets countdownDate for minutes, and no amount of polling converges on that. Waits 240s
  // (readers are cheap to retry); the assertion's timeout_seconds covers wait + runtime.
  await withDatasetLock('check-faq-grouping (read)', async () => {
    const client = getSanityClient();
    const all = await client.fetch('*[_type == "showFaq"]{ _id, question, category, order, active }');

    r.check(Array.isArray(all) && all.length > 0, 'showFaq documents exist in the dataset');
    if (!all?.length) return;

    const active = all.filter((f) => f.active !== false);
    const inactive = all.filter((f) => f.active === false);

    // settlePage keyed on an active question: the needles are dataset rows, so a single fetch
    // races any writer — see _shared.mjs.
    const body = await settlePage(PATHS.faq, async () => {
      const now = await client.fetch('*[_type == "showFaq" && active == true]{ question }');
      return (now ?? []).slice(0, 3).map((f) => f.question);
    });
    const text = visibleText(body);

    // Spec §4.17's four categories must all be represented in the seeded content.
    for (const cat of ['getting-there', 'tickets', 'accessibility', 'plant-sales']) {
      r.check(
        active.some((f) => f.category === cat),
        `at least one active FAQ is seeded in the "${cat}" category`,
      );
    }

    for (const faq of active) {
      r.check(text.includes(faq.question), `${PATHS.faq} renders "${faq.question}"`);
    }
    for (const faq of inactive) {
      r.check(!text.includes(faq.question), `${PATHS.faq} hides the inactive FAQ "${faq.question}"`);
    }

    // Ordering within each category, read off the rendered page by index position.
    for (const cat of CATEGORY_ORDER) {
      const inCat = active
        .filter((f) => f.category === cat)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.question.localeCompare(b.question));
      if (inCat.length < 2) continue;

      const positions = inCat.map((f) => ({ q: f.question, at: text.indexOf(f.question) }));
      const missing = positions.filter((p) => p.at === -1);
      if (missing.length) {
        r.fail(`${cat}: every question is on the page before ordering can be checked`, JSON.stringify(missing.map((m) => m.q)));
        continue;
      }
      const sorted = positions.every((p, i) => i === 0 || positions[i - 1].at < p.at);
      r.check(sorted, `${PATHS.faq} renders "${cat}" questions in order`, JSON.stringify(positions));
    }

    // Category ordering across the page: the first question of each populated category must
    // appear in the fixed presentation order.
    const firstOfCategory = CATEGORY_ORDER.map((cat) => {
      const inCat = active
        .filter((f) => f.category === cat)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.question.localeCompare(b.question));
      return inCat.length ? { cat, at: text.indexOf(inCat[0].question) } : null;
    }).filter((x) => x && x.at !== -1);

    const categoriesSorted = firstOfCategory.every((c, i) => i === 0 || firstOfCategory[i - 1].at < c.at);
    r.check(categoriesSorted, `${PATHS.faq} renders categories in the fixed presentation order`, JSON.stringify(firstOfCategory));

    // Cross-links required by the feature brief.
    r.check(linksTo(body, PATHS.plan), `${PATHS.faq} cross-links to Plan Your Visit`);
    r.check(linksTo(body, PATHS.contact), `${PATHS.faq} cross-links to Contact`);
  }, { waitTimeoutMs: 240_000 });
});
