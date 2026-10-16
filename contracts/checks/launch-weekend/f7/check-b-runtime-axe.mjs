#!/usr/bin/env node
// F7a-A2 - axe-core on a local prod build at 1440 and 390: zero serious/critical violations of any rule, and zero
// `region`, `heading-order`, `target-size` or `aria-allowed-attr` violations, on the listed routes. Items parked as design
// questions live in goldens/f7/parked.json (route + rule + target regex + reason); everything else must be clean.
import { BASE, GOLDEN_DIR, readJson, withBrowser, open, runAxe, firstSocietyHref, report } from './_lib.mjs';

const parked = readJson(`${GOLDEN_DIR}/parked.json`).parked;
const ROUTES = ['/', '/societies', '/about', '/judging', '/events', '/sponsors', '/contact', '/media-kit', '/members', '/privacy', '/tickets', '/national-show', '/national-show/vendors/apply'];
const ALWAYS = new Set(['region', 'heading-order', 'target-size', 'aria-allowed-attr']);
const VIEWPORTS = [
  ['desktop', { width: 1440, height: 900 }, {}],
  ['mobile', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }],
];
const problems = [];
let parkedHits = 0;

for (const [name, vp, opts] of VIEWPORTS) {
  await withBrowser(async (ctx) => {
    const page = await ctx.newPage();
    const routes = [...ROUTES];
    const slug = await firstSocietyHref(page);
    if (slug) routes.push(slug);
    for (const r of routes) {
      const status = await open(page, r);
      if (status !== 200) { problems.push(`${name} ${r}: HTTP ${status}`); continue; }
      for (const v of await runAxe(page)) {
        if (!(ALWAYS.has(v.id) || v.impact === 'serious' || v.impact === 'critical')) continue;
        for (const n of v.nodes) {
          const hit = parked.find((p) => p.route === r && p.rule === v.id && new RegExp(p.target).test(n.target));
          if (hit) { parkedHits++; continue; }
          problems.push(`${name} ${r}: ${v.impact} ${v.id} ${n.target} :: ${n.summary.slice(0, 110)}`);
        }
      }
    }
  }, vp, opts);
}
report(problems, `axe clean on ${ROUTES.length + 1} routes x 2 viewports at ${BASE} (${parkedHits} node(s) parked as design questions)`);
