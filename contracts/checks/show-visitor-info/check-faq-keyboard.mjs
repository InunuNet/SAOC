#!/usr/bin/env node
// F4 accessibility: the FAQ disclosure must be keyboard-operable and must not be a JS-only
// reveal. Driven with real Playwright keyboard input, not a grep for "<details>".
//
// Three separate claims, each of which a hand-rolled accordion typically fails:
//   1. A summary can be reached by pressing Tab (it is in the natural focus order).
//   2. Pressing Enter on the focused summary opens the panel and its answer becomes visible.
//   3. With JavaScript disabled the disclosure still exists and every answer is present in
//      the DOM — so the page is printable, in-page-searchable, and usable without JS.
//
// Uses the `playwright` devDependency directly (chromium), matching the house pattern in
// contracts/checks/f6-prove-cms-loop/.

import { chromium } from 'playwright';

import { BASE_URL, PATHS, runCheck, getSanityClient } from './_shared.mjs';
import { withDatasetLock } from './_mutation-guard.mjs';

const MAX_TABS = 60;

await runCheck('check-faq-keyboard', async (r) => {
  // READ LOCK. The questions this check drives come from the dataset, so like the other
  // dataset-sourced rendered checks it must not observe a dataset a mutating check has
  // deliberately invalidated mid-flight. No settlePage(): this one asserts on the DOM through
  // Playwright rather than on a fetched body, and its needle is structural (a summary element
  // exists and opens), not a specific value that could be mid-propagation.
  await withDatasetLock('check-faq-keyboard (read)', async () => {
    const client = getSanityClient();
    const faqs = await client.fetch('*[_type == "showFaq" && active == true]{ question }');
    r.check(Array.isArray(faqs) && faqs.length > 0, 'active showFaq documents exist to render');

    const browser = await chromium.launch();
    try {
      // ---- 1 & 2: keyboard operation, JS enabled ----
      const page = await browser.newPage();
      // `domcontentloaded` raced hydration: @qa instrumented five runs and found 22 focusable
      // elements in the mid-hydration tree (including a search input/button that is absent once
      // settled) versus 11 in the settled one, and one run wrapped focus back to <body> after 22
      // tabs without ever reaching a <summary>. The check passed and failed within ten minutes
      // with no code change. The real tab count is a stable 12 — raising MAX_TABS would only have
      // masked the race. Wait for the network to settle, then for the disclosures to be attached.
      // See .agent/memory/scratch/visitor-qa.md S5.
      await page.goto(`${BASE_URL}${PATHS.faq}`, { waitUntil: 'networkidle' });
      await page.locator('details > summary').first().waitFor({ state: 'attached', timeout: 15_000 });

      const summaries = page.locator('details > summary');
      const summaryCount = await summaries.count();
      r.check(summaryCount > 0, 'FAQ answers use a native <details>/<summary> disclosure', `found ${summaryCount}`);
      if (summaryCount === 0) return;

      const detailsCount = await page.locator('details').count();
      r.check(
        detailsCount >= (faqs?.length ?? 0),
        'there is one disclosure per active FAQ',
        `${detailsCount} <details> for ${faqs?.length} active FAQ(s)`,
      );

      // Every disclosure starts closed — otherwise "opening" proves nothing.
      const openAtLoad = await page.locator('details[open]').count();
      r.check(openAtLoad === 0, 'every disclosure starts collapsed', `${openAtLoad} already open`);

      // Tab from the top of the document until focus lands on a summary. If focus never
      // reaches one, the disclosure is not in the keyboard order — a real a11y failure.
      await page.evaluate(() => document.body.focus());
      let tabs = 0;
      let focusedSummary = false;
      while (tabs < MAX_TABS && !focusedSummary) {
        await page.keyboard.press('Tab');
        tabs += 1;
        focusedSummary = await page.evaluate(
          () => document.activeElement?.tagName?.toLowerCase() === 'summary',
        );
      }
      r.check(focusedSummary, 'a summary is reachable by pressing Tab', `gave up after ${tabs} tabs`);
      if (!focusedSummary) return;

      const focusedQuestion = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
      console.log(`  focused summary after ${tabs} tab(s): ${JSON.stringify(focusedQuestion.slice(0, 80))}`);

      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const openedByKeyboard = await page.evaluate(
        () => document.activeElement?.closest('details')?.hasAttribute('open') ?? false,
      );
      r.check(openedByKeyboard, 'pressing Enter on the focused summary opens the disclosure');

      const answerVisible = await page.evaluate(() => {
        const d = document.activeElement?.closest('details');
        if (!d) return false;
        const panel = Array.from(d.children).find((c) => c.tagName.toLowerCase() !== 'summary');
        if (!panel) return false;
        const rect = panel.getBoundingClientRect();
        return rect.height > 0 && rect.width > 0;
      });
      r.check(answerVisible, 'the answer panel becomes visible once opened');

      // Closing again with the keyboard — a disclosure that only opens is half-built.
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      const closedByKeyboard = await page.evaluate(
        () => !(document.activeElement?.closest('details')?.hasAttribute('open') ?? true),
      );
      r.check(closedByKeyboard, 'pressing Enter again closes the disclosure');

      await page.close();

      // ---- 3: no JS-only reveal ----
      const noJsContext = await browser.newContext({ javaScriptEnabled: false });
      const noJsPage = await noJsContext.newPage();
      // No JS to hydrate here, so domcontentloaded is not a race — but keep it consistent.
      await noJsPage.goto(`${BASE_URL}${PATHS.faq}`, { waitUntil: 'load' });

      const noJsSummaries = await noJsPage.locator('details > summary').count();
      r.check(noJsSummaries > 0, 'the disclosure still renders with JavaScript disabled', `found ${noJsSummaries}`);

      const noJsText = await noJsPage.evaluate(() => document.body.innerText + ' ' + document.body.textContent);
      for (const faq of faqs ?? []) {
        r.check(
          noJsText.includes(faq.question),
          `"${faq.question.slice(0, 50)}…" is in the DOM without JavaScript`,
        );
      }

      await noJsContext.close();
    } finally {
      await browser.close();
    }
  }, { waitTimeoutMs: 240_000 });
});
