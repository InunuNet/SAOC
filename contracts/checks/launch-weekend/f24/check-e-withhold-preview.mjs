#!/usr/bin/env node
// F24-A5 (live, BETA PREVIEW build, BASE_URL; SHOW_PLACEHOLDER_PREVIEW=true with the wall up): the same two sites SHOW the '21' on the
// preview, each inside a [data-placeholder] element that carries a marker string on itself or its parent. Fails if the figure is absent
// (the preview build is not in preview mode, or the withhold is unconditional) or shown unmarked.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f24/check-e-withhold-preview.mjs
import { BASE, VIEWPORTS, launch, newPage, report, loadGolden } from './_meta.mjs';

const G = loadGolden('withhold.json');
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
for (const site of G.sites) {
  const res = await page.goto(`${BASE}${site.route}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => { console.error(`INFRA: ${e.message}`); process.exit(2); });
  if (!res || res.status() >= 400) { console.error(`INFRA: HTTP ${res ? res.status() : 'none'} for ${BASE}${site.route}`); process.exit(2); }
  const found = await page.evaluate(({ re, markers }) => {
    const rx = new RegExp(re, 'i'); const out = [];
    const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode; if (!rx.test(n.textContent)) continue;
      const ph = n.parentElement.closest('[data-placeholder]');
      const scope = ph && ph.parentElement ? ph.parentElement.textContent : '';
      out.push({ text: n.textContent.trim().slice(0, 50), marked: !!ph && markers.some((s) => ph.textContent.includes(s) || scope.includes(s)) });
    }
    return out;
  }, { re: G.unsourcedRe, markers: G.markerStrings });
  if (!found.length) problems.push(`${site.route}: no '21' on the preview build (${site.id}); it must show, marked`);
  for (const f of found) if (!f.marked) problems.push(`${site.route}: "${f.text}" is shown without a [data-placeholder] marker (${site.id})`);
}
await ctx.close(); await browser.close();
report(problems, `the '21' is shown marked on ${G.sites.length} preview sites`);
