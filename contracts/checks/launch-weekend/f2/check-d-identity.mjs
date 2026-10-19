#!/usr/bin/env node
// A4 — the SAOC chrome changes ONLY through the CTA swap. On /, /societies, /about, /contact at 390 and 1280:
// the header height is unchanged (+-1px), and every text-bearing element outside <header> and the mobile menu
// (utility bar, page body, footer) has the same tag, box (+-3px) and type/colour as the golden from origin/main.
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f2/check-d-identity.mjs
import { BASE, PAGES, VIEWPORTS, launch, newPage, open, loadGolden, outsideHeaderInPage, report } from './_lib.mjs';

const golden = loadGolden();
const TOL = 3;
const problems = [];
const browser = await launch();
for (const vp of VIEWPORTS) {
  for (const route of PAGES) {
    const key = `${vp.name} ${route}`;
    const base = golden.pages[key];
    const { ctx, page } = await newPage(browser, vp);
    await open(page, route);
    const now = await page.evaluate(outsideHeaderInPage);
    if (Math.abs(now.headerHeight - base.headerHeight) > 1) problems.push(`${key}: header height ${base.headerHeight} -> ${now.headerHeight}`);
    if (now.rows.length !== base.rows.length) problems.push(`${key}: ${base.rows.length} text elements outside the header -> ${now.rows.length}`);
    else {
      let diffs = 0, first = '';
      now.rows.forEach((r, i) => {
        const b = base.rows[i];
        const same = r.t === b.t && r.s === b.s && ['x', 'y', 'w', 'h'].every((k) => Math.abs(r[k] - b[k]) <= TOL);
        if (!same) { diffs++; if (!first) first = `#${i} ${b.t} ${b.x},${b.y},${b.w}x${b.h} -> ${r.t} ${r.x},${r.y},${r.w}x${r.h}${r.s !== b.s ? ' (style changed)' : ''}`; }
      });
      if (diffs) problems.push(`${key}: ${diffs} element(s) outside the header changed, first: ${first}`);
    }
    await ctx.close();
  }
}
await browser.close();
report(problems, `everything outside the header is identical to origin/main on ${PAGES.length} pages x ${VIEWPORTS.length} viewports at ${BASE}`);
