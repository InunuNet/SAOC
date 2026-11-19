#!/usr/bin/env node
// F19-A2 (R79 #1 / R64 / WCAG 1.4.3), updated 18 Nov: on EVERY carousel slide, at 1280 and 390, each hero text target
// measures its WCAG AA ratio on the rendered pixels it sits on (glyphs hidden, text colour composited, 2nd-percentile
// worst pixel; CTA boxes inset 4px to skip the border):
//   h1 and its italic accent  large text (>= 24px): 3:1
//   the three mono labels under the CTAs (11px) and the three CTAs (14px): 4.5:1
// The home hero has no lede. Needs the eight slides the live carousel has.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-b-contrast.mjs
import { VIEWPORTS, launch, newPage, open, measureHeroContrast, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').contrast;
const problems = [];
const browser = await launch();
const lines = [];
const isLarge = (t) => (t.name === 'h1' || t.name === 'h1 em') && t.size >= T.largeMinPx;
const REQUIRED = ['h1', 'h1 em', 'meta1', 'meta2', 'meta3'];
const CTA_COUNT = 3;
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/');
  const slides = await measureHeroContrast(page);
  if (slides.length < T.slides) problems.push(`${vp.name}: expected ${T.slides} carousel slides, found ${slides.length}`);
  for (const s of slides) {
    const names = s.targets.map((t) => t.name);
    for (const need of REQUIRED) if (!names.includes(need)) problems.push(`${vp.name} slide ${s.slide}: no "${need}" target found`);
    if (s.targets.filter((t) => t.name.startsWith('cta')).length < CTA_COUNT) problems.push(`${vp.name} slide ${s.slide}: fewer than ${CTA_COUNT} hero CTAs found`);
    for (const t of s.targets) {
      if (t.ratio === null) { problems.push(`${vp.name} slide ${s.slide} ${t.name}: nothing sampled`); continue; }
      const need = isLarge(t) ? T.largeMin : T.min;
      if (t.ratio < need) problems.push(`${vp.name} slide ${s.slide} ${t.name} (${t.size}px): ${t.ratio}:1 < ${need}:1`);
    }
    lines.push(`${vp.name} s${s.slide} ${s.targets.map((t) => `${t.name.slice(0, 6)}=${t.ratio}`).join(' ')}`);
  }
  await ctx.close();
}
await browser.close();
if (process.env.F19_VERBOSE) console.log(lines.join('\n'));
report(problems, `h1 and accent >= ${T.largeMin}:1 (large text), CTA labels and the three mono labels >= ${T.min}:1 on all ${T.slides} slides at 1280 and 390`);
