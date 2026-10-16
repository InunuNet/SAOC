#!/usr/bin/env node
// F19-A2 (R79 #1 / R64 / WCAG 1.4.3): on EVERY carousel slide, at 1280 and 390, the hero h1 (roman and the italic accent), lede
// and both CTAs measure >= 4.5:1 on the rendered pixels they sit on (glyphs hidden, text colour composited, 2nd-percentile
// worst pixel; CTA boxes inset 4px to skip the border). Needs the four slides the live carousel has.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-b-contrast.mjs
import { VIEWPORTS, launch, newPage, open, measureHeroContrast, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').contrast;
const problems = [];
const browser = await launch();
const lines = [];
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/');
  const slides = await measureHeroContrast(page);
  if (slides.length < T.slides) problems.push(`${vp.name}: expected ${T.slides} carousel slides, found ${slides.length}`);
  for (const s of slides) {
    const names = s.targets.map((t) => t.name);
    for (const need of ['h1', 'h1 em', 'lede']) if (!names.includes(need)) problems.push(`${vp.name} slide ${s.slide}: no "${need}" target found`);
    if (s.targets.filter((t) => t.name.startsWith('cta')).length < 2) problems.push(`${vp.name} slide ${s.slide}: fewer than 2 hero CTAs found`);
    for (const t of s.targets) {
      if (t.ratio === null) { problems.push(`${vp.name} slide ${s.slide} ${t.name}: nothing sampled`); continue; }
      if (t.ratio < T.min) problems.push(`${vp.name} slide ${s.slide} ${t.name}: ${t.ratio}:1 < ${T.min}:1`);
    }
    lines.push(`${vp.name} s${s.slide} ${s.targets.map((t) => `${t.name.slice(0, 6)}=${t.ratio}`).join(' ')}`);
  }
  await ctx.close();
}
await browser.close();
if (process.env.F19_VERBOSE) console.log(lines.join('\n'));
report(problems, `h1, accent, lede and both CTAs >= ${T.min}:1 on all ${T.slides} slides at 1280 and 390`);
