#!/usr/bin/env node
// F19-A22 (vote 1C, beta preview build: SHOW_PLACEHOLDER_PREVIEW=true with the wall up, BASE_URL): the unsourced facts that the public
// build withholds are SHOWN on the beta preview, each inside a [data-placeholder] element that carries one of the existing marker strings
// (Not confirmed by SAOC, To be confirmed, Not yet confirmed, Awaiting confirmation). /about shows its 6 committee cards with the marker,
// /sponsors is headed "Sponsors" in BOTH modes (it is not content-gated), and the sourced items need no marker.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-o-preview.mjs
import { VIEWPORTS, launch, newPage, open, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').provenance;
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
let seen = 0;
for (const r of T.routes) {
  await open(page, r);
  const res = await page.evaluate(({ unsourced, markers, route }) => {
    const main = document.querySelector('main'); const out = []; const missing = [];
    for (const u of unsourced) {
      if (u.routes && !u.routes.includes(route)) continue; if (u.exceptRoutes && u.exceptRoutes.includes(route)) continue;
      const re = new RegExp(u.re, u.flags || '');
      const hits = [];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const n = walker.currentNode; if (re.test(n.textContent)) hits.push(n.parentElement); }
      for (const el of hits) {
        const ph = el.closest('[data-placeholder]');
        if (!ph) { missing.push(`${u.id}: "${el.textContent.trim().slice(0, 40)}" is not inside [data-placeholder]`); continue; }
        const scope = ph.parentElement ? ph.parentElement.textContent : ph.textContent;
        if (!markers.some((m) => ph.textContent.includes(m) || scope.includes(m))) missing.push(`${u.id}: placeholder around "${el.textContent.trim().slice(0, 30)}" has no marker string`);
      }
      if (hits.length) out.push(u.id);
    }
    return { present: out, missing, h1: [...main.querySelectorAll('h1')].map((h) => h.textContent.trim()), h3: [...main.querySelectorAll('h3')].map((h) => h.textContent.trim()), awaiting: main.textContent.split('Awaiting confirmation').length - 1 };
  }, { unsourced: T.unsourced, markers: T.markerStrings, route: r });
  seen += res.present.length;
  res.missing.forEach((x) => problems.push(`${r}: ${x}`));
  if (r === '/about') {
    if (res.h3.filter((t) => t === 'To be confirmed').length !== 6) problems.push(`/about: want the 6 committee cards in preview, found ${res.h3.filter((t) => t === 'To be confirmed').length}`);
    if (res.awaiting < 6) problems.push(`/about: want a marker on each of the 6 cards, found ${res.awaiting}`);
  }
  if (r === '/sponsors' && (res.h1.length !== 1 || res.h1[0] !== 'Sponsors')) problems.push(`/sponsors: preview h1 is ${JSON.stringify(res.h1)}, want ["Sponsors"]`);
}
await ctx.close(); await browser.close();
if (seen < 8) problems.push(`only ${seen} unsourced categories visible in preview: the preview build is not in preview mode (SHOW_PLACEHOLDER_PREVIEW=true, wall up) or the facts are hidden there too`);
report(problems, `every withheld fact is visible and marked on the beta preview (${seen} categories)`);
