#!/usr/bin/env node
// F19-A12: no National Show route moved. For the 17 NOS routes at 1280 and 390 the set of "tag|font-size|line-height" signatures and
// the set of left edges of h1/h2/h3/p in <main> equal nos-baseline.json (captured from untouched main), ignoring paragraphs inside a
// PageHero root (its lede legitimately goes 17px to 16px with R65 on /national-show/about and /national-show/tickets/buy). A global
// edit (globals.css leading, a shared class) that leaks into NOS fails here; F18's own NOS work is not on this branch's build.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-l-nos-runtime.mjs
import { VIEWPORTS, launch, newPage, open, report, loadGolden } from './_lib.mjs';
import { NOS_ROUTES, FINGERPRINT_SRC } from './_nos.mjs';

const base = loadGolden('nos-baseline.json');
const problems = [];
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  for (const r of NOS_ROUTES) {
    await open(page, r);
    const got = await page.evaluate(FINGERPRINT_SRC); const want = base.routes[`${vp.name}${r}`];
    if (!want) { problems.push(`${vp.name} ${r}: no baseline entry`); continue; }
    const sigNew = got.sig.filter((s) => !want.sig.includes(s)); const sigGone = want.sig.filter((s) => !got.sig.includes(s));
    const lNew = got.left.filter((s) => !want.left.includes(s)); const lGone = want.left.filter((s) => !got.left.includes(s));
    if (sigNew.length || sigGone.length) problems.push(`${vp.name} ${r}: type signatures changed (+${sigNew.join(',') || '-'} / -${sigGone.join(',') || '-'})`);
    if (lNew.length || lGone.length) problems.push(`${vp.name} ${r}: left edges changed (+${lNew.join(',') || '-'} / -${lGone.join(',') || '-'})`);
  }
  await ctx.close();
}
await browser.close();
report(problems, `${NOS_ROUTES.length} National Show routes unchanged at 1280 and 390 (type signatures and left edges)`);
