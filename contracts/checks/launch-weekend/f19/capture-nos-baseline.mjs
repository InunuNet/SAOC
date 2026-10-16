#!/usr/bin/env node
// Captures goldens/f19/nos-baseline.json from a build of UNTOUCHED main: for every National Show route at 1280 and 390,
// the SET of "tag|fontSize|lineHeight" signatures and the SET of left edges (rounded to 1px, centred text skipped) of h1/h2/h3/p in <main>,
// ignoring paragraphs inside a PageHero root (section.isolate - its lede legitimately moves 17px to 16px with R65).
// Sets, not multisets, so CMS content counts cannot flake the comparison. Used by check-l-nos-runtime.mjs.
// Usage: BASE_URL=http://localhost:3012 node contracts/checks/launch-weekend/f19/capture-nos-baseline.mjs
import { writeFileSync } from 'node:fs';
import { VIEWPORTS, GOLDEN_DIR, launch, newPage, open } from './_lib.mjs';
import { NOS_ROUTES, FINGERPRINT_SRC } from './_nos.mjs';

const browser = await launch();
const out = { head: process.env.BASE_HEAD || '76ad8b98', routes: {} };
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  for (const r of NOS_ROUTES) {
    await open(page, r);
    out.routes[`${vp.name}${r}`] = await page.evaluate(FINGERPRINT_SRC);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${GOLDEN_DIR}/nos-baseline.json`, JSON.stringify(out, null, 1) + '\n');
console.log(`captured ${Object.keys(out.routes).length} route/viewport fingerprints`);
