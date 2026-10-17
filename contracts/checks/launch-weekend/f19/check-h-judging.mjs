#!/usr/bin/env node
// F19-A8 (R72 #2): /judging at >=1024 lays its three prose sections (Overview, How judging works, Becoming a judge) out 4fr/7fr:
// the section's heading (the existing h2) in the narrow left column on the axis, the prose block in the wide right column, prose
// measure <= 60ch, both top-aligned. Below 1024 they stack in one column. Each such section carries data-judging-split.
// No new copy (check-m). Awards grid and judges list are unchanged and not asserted here.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-h-judging.mjs
import { launch, newPage, open, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').judging;
const problems = [];
const browser = await launch();
for (const vp of [{ name: '390', width: 390, height: 844, isMobile: true }, { name: '1024', width: 1024, height: 800 }, { name: '1280', width: 1280, height: 900 }, { name: '1920', width: 1920, height: 1080 }]) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/judging');
  const secs = await page.evaluate((heads) => {
    const logo = document.querySelector('header a[href="/"]').getBoundingClientRect().left;
    const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, r: r.right }; };
    const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;width:60ch'; document.body.appendChild(probe);
    const out = heads.map((h) => {
      const sec = [...document.querySelectorAll('main section')].find((s) => [...s.querySelectorAll('h2')].some((x) => x.textContent.trim().toLowerCase() === h.toLowerCase()));
      if (!sec) return { h, missing: true };
      const split = sec.matches('[data-judging-split]') ? sec : sec.querySelector('[data-judging-split]');
      const h2 = [...sec.querySelectorAll('h2')].find((x) => x.textContent.trim().toLowerCase() === h.toLowerCase());
      const prose = sec.querySelector('p, [class*="prose"], .portable-text') || [...sec.querySelectorAll('div')].find((d) => d.querySelector('p'));
      const first = prose && (prose.tagName === 'P' ? prose : prose.querySelector('p'));
      let measure = null; if (first) { probe.style.fontFamily = getComputedStyle(first).fontFamily; probe.style.fontSize = getComputedStyle(first).fontSize; measure = { w: first.getBoundingClientRect().width, max: probe.getBoundingClientRect().width }; }
      const cols = split ? getComputedStyle(split).gridTemplateColumns.split(' ').map(parseFloat) : null;
      return { h, split: !!split, h2: R(h2), prose: prose ? R(prose) : null, measure, cols, splitBox: split ? R(split) : null };
    });
    probe.remove();
    return { logo, out };
  }, T.sections);
  for (const s of secs.out) {
    if (s.missing) { problems.push(`${vp.name}: section "${s.h}" not found`); continue; }
    if (!s.split) { problems.push(`${vp.name} "${s.h}": no [data-judging-split] container`); continue; }
    if (Math.abs(s.h2.x - secs.logo) > 1.5) problems.push(`${vp.name} "${s.h}": heading at ${Math.round(s.h2.x)}, axis ${Math.round(secs.logo)}`);
    if (s.measure && s.measure.w > s.measure.max + 1) problems.push(`${vp.name} "${s.h}": prose measure ${Math.round(s.measure.w)}px exceeds 60ch (${Math.round(s.measure.max)}px)`);
    if (vp.width >= 1024) {
      if (!s.cols || s.cols.length !== 2) { problems.push(`${vp.name} "${s.h}": split is not a two-column grid (${s.cols})`); continue; }
      const ratio = s.cols[0] / s.cols[1];
      if (Math.abs(ratio - 4 / 7) > 0.03) problems.push(`${vp.name} "${s.h}": columns ${s.cols.map(Math.round)} are not 4fr/7fr (ratio ${ratio.toFixed(2)})`);
      if (s.prose.x < s.h2.x + s.cols[0] - 2) problems.push(`${vp.name} "${s.h}": prose (${Math.round(s.prose.x)}) is not in the right column`);
      if (Math.abs(s.prose.y - s.h2.y) > T.topAlignTolPx) problems.push(`${vp.name} "${s.h}": heading and prose tops differ by ${Math.round(Math.abs(s.prose.y - s.h2.y))}px`);
    } else if (Math.abs(s.prose.x - s.h2.x) > 1.5) problems.push(`${vp.name} "${s.h}": must stack in one column below 1024`);
  }
  await ctx.close();
}
await browser.close();
report(problems, '/judging prose sections are 4fr/7fr heading | prose (<=60ch) at >=1024 and stack below');
