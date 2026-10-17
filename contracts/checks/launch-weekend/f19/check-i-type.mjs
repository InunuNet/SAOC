#!/usr/bin/env node
// F19-A9 (R65 SAOC side, README l.100 "Sans body - Manrope - 16px base, 1.55 line-height"; R72 #3): on home, /about, /events, /judging,
// /contact, /sponsors and /members at 1280 and 390, every prose element (p, li, dd, blockquote of >= 7 words, not mono, outside
// header/footer/nav) is >= 16px; any that is exactly 16px has line-height 24.8px (1.55); the PageHero lede ([data-page-hero] p, also
// checked on /societies and /media-kit) is 16px / 24.8px; and on home every prose element outside the hero (MissionBlock,
// YearbookStrip, ...) is 16px / 24.8px. app/globals.css has no line-height 1.65 left (.p-lg 1.65 -> 1.55). Labels and meta (mono, or
// under 7 words, or the society and media-kit meta lines on routes not listed above) stay at 12-14px and are not asserted here.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-i-type.mjs
import { readFileSync } from 'node:fs';
import { VIEWPORTS, launch, newPage, open, report, loadGolden, ROOT } from './_lib.mjs';

const T = loadGolden('tokens.json').type;
const problems = [];
const browser = await launch();
const PROSE = `(() => {
  const out = [];
  document.querySelectorAll('main p, main li, main dd, main blockquote').forEach((el) => {
    if (el.closest('header, footer, nav')) return;
    const words = (el.textContent || '').trim().split(/\\s+/).filter(Boolean).length; const cs = getComputedStyle(el);
    if (words < 7 || cs.fontFamily.toLowerCase().includes('mono') || el.querySelector('p, li')) return;
    out.push({ text: el.textContent.trim().slice(0, 30), fs: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight), hero: !!el.closest('section[aria-roledescription="carousel"]'), pageHero: !!el.closest('[data-page-hero]') });
  });
  return out;
})()`;
const lhOk = (e) => Math.abs(e.lh - e.fs * T.leading) <= 0.4;
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  for (const r of [...new Set([...T.routes, ...T.pageHeroRoutes])]) {
    await open(page, r);
    const els = await page.evaluate(PROSE);
    for (const e of els) {
      const tag = `${vp.name} ${r} "${e.text}" ${e.fs}px/${Math.round(e.lh * 10) / 10}`;
      if (e.pageHero) { if (e.fs !== T.bodyPx || !lhOk(e)) problems.push(`${tag}: PageHero lede must be ${T.bodyPx}px / ${T.bodyPx * T.leading}px`); continue; }
      if (T.routes.includes(r)) {
        if (e.fs < T.bodyPx) problems.push(`${tag}: prose under ${T.bodyPx}px`);
        if (e.fs === T.bodyPx && !lhOk(e)) problems.push(`${tag}: 16px prose must have line-height ${T.bodyPx * T.leading}px`);
        if (r === '/' && !e.hero && (e.fs !== T.bodyPx || !lhOk(e))) problems.push(`${tag}: home prose outside the hero must be ${T.bodyPx}px / ${T.bodyPx * T.leading}px`);
      }
    }
    if (T.pageHeroRoutes.includes(r) && !(await page.locator('[data-page-hero]').count())) problems.push(`${vp.name} ${r}: PageHero root has no data-page-hero hook`);
  }
  await ctx.close();
}
await browser.close();
const css = readFileSync(`${ROOT}app/globals.css`, 'utf8');
if (/line-height:\s*1\.65/.test(css)) problems.push('app/globals.css still has a line-height: 1.65 declaration');
report(problems, 'SAOC prose is >= 16px, 16px prose leads at 1.55, PageHero lede / MissionBlock / YearbookStrip are 16/24.8');
