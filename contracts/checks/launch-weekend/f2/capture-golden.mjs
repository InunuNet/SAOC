#!/usr/bin/env node
// Captures header-baseline.json from a clean origin/main build (set GOLDEN_SOURCE_DIR to its worktree so the SHA is
// that tree's). Records: the existing Contact button's style and slot geometry at 1280 and 1000, the utility-bar
// pill, and per page x viewport the identity of everything outside header and mobile menu.
// Never re-capture from the implementation tree. Usage: BASE_URL=... GOLDEN_SOURCE_DIR=... node <this file>
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BASE, GOLDEN_DIR, PAGES, CTA_STYLE_PROPS, launch, newPage, open, actionLinkInPage, outsideHeaderInPage } from './_lib.mjs';

const browser = await launch();
const out = { capturedFrom: BASE, capturedAt: new Date().toISOString(), head: execFileSync('git', ['-C', process.env.GOLDEN_SOURCE_DIR || '.', 'rev-parse', 'HEAD']).toString().trim(), contact: {}, pill: null, pages: {} };
for (const width of [1280, 1000]) {
  const { ctx, page } = await newPage(browser, { width, height: 900, isMobile: false });
  await open(page, '/');
  out.contact[width] = await page.evaluate(`(${actionLinkInPage})('/contact', ${JSON.stringify(CTA_STYLE_PROPS)})`);
  if (width === 1280) {
    out.pill = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href="/national-show"]')].find((e) => !e.closest('header,footer,main') && e.checkVisibility()); return a ? { href: a.getAttribute('href'), text: a.textContent.trim() } : null; });
  }
  await ctx.close();
}
for (const vp of [{ name: '390', width: 390, height: 844, isMobile: true }, { name: '1280', width: 1280, height: 900, isMobile: false }]) {
  for (const route of PAGES) {
    const { ctx, page } = await newPage(browser, vp);
    await open(page, route);
    out.pages[`${vp.name} ${route}`] = await page.evaluate(outsideHeaderInPage);
    await ctx.close();
  }
}
await browser.close();
if (!out.contact[1280] || !out.contact[1000] || !out.pill) { console.error('golden incomplete: contact button or pill not found'); process.exit(2); }
writeFileSync(`${GOLDEN_DIR}/header-baseline.json`, JSON.stringify(out, null, 2) + '\n');
console.log(`captured ${Object.keys(out.pages).length} pages from ${BASE} @ ${out.head}`);
