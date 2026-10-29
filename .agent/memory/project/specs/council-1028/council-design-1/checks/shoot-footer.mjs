// REPORT ONLY (council-design-1 C1/C5/C3 "by eye" gates): screenshots for NOS Design at 1440 and 390, written to .tmp/sandbox/council-1028/shots.
// Footer on /about, a society page link row, and the hero CTA row on Home when it renders. Always exits 0.
import { mkdirSync } from 'node:fs';
import { withSite, societyDetail } from './council-lib.mjs';

const OUT = '.tmp/sandbox/council-1028/shots'; mkdirSync(OUT, { recursive: true });
await withSite(async ({ base, browser, ctxOpts }) => {
  const soc = await societyDetail(base);
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 }, 2)); const page = await ctx.newPage();
    await page.goto(base + '/about', { waitUntil: 'networkidle', timeout: 120000 });
    await page.locator('footer').screenshot({ path: `${OUT}/footer-${width}.png` });
    if (soc) { await page.goto(base + soc, { waitUntil: 'networkidle', timeout: 120000 }); const sec = page.locator('section', { hasText: 'About this society' }).first(); if (await sec.count()) await sec.screenshot({ path: `${OUT}/society-links-${width}.png` }); }
    await ctx.close();
  }
  console.log(`shots written to ${OUT}`);
});
