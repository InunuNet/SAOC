#!/usr/bin/env node
// F19-A6 (R80 #2): home hero spacing. The h1 to lede gap is a type-scale value (16-20px at 390; 16-32px at 1280 - today it is 0
// because the unlayered global .h1 rule {margin:0} beats the mb-6 utility), and at 390 the two CTAs (data-hero-cta) are the same width,
// either both the full content width or both centred, each >= 44px tall; at 1280 they stay side by side.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-f-hero-mobile.mjs
import { VIEWPORTS, launch, newPage, open, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').heroSpacing;
const problems = [];
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/');
  const m = await page.evaluate(() => {
    const hero = document.querySelector('section[aria-roledescription="carousel"]');
    const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, b: r.bottom, w: r.width, h: r.height, r: r.right }; };
    const lede = hero.querySelector('[data-hero-lede]');
    return { h1: R(hero.querySelector('h1')), lede: R(lede), wrap: R(hero.querySelector('[data-hero-ctas]')), ctas: [...hero.querySelectorAll('[data-hero-cta]')].map(R), vw: innerWidth };
  });
  if (!m.lede || m.ctas.length !== 2) { problems.push(`${vp.name}: hooks missing ([data-hero-lede] ${!!m.lede}, [data-hero-cta] x${m.ctas.length})`); await ctx.close(); continue; }
  const gap = m.lede.y - m.h1.b; const [lo, hi] = vp.width < 640 ? T.gapPx390 : T.gapPx1280;
  if (gap < lo - 0.5 || gap > hi + 0.5) problems.push(`${vp.name}: h1 to lede gap ${Math.round(gap * 10) / 10}px, want ${lo}-${hi}px`);
  m.ctas.forEach((c, i) => { if (c.h < 44) problems.push(`${vp.name}: hero CTA ${i + 1} is ${Math.round(c.h)}px tall (< 44)`); });
  if (vp.width < 640) {
    const [a, b] = m.ctas;
    if (Math.abs(a.w - b.w) > 1) problems.push(`${vp.name}: CTA widths differ (${Math.round(a.w)} vs ${Math.round(b.w)})`);
    const full = Math.abs(a.w - m.wrap.w) <= 1 && Math.abs(b.w - m.wrap.w) <= 1;
    const centred = [a, b].every((c) => Math.abs(c.x - (m.vw - c.w) / 2) <= 1.5);
    if (!full && !centred) problems.push(`${vp.name}: CTAs are neither full width (wrapper ${Math.round(m.wrap.w)}) nor centred (x ${Math.round(a.x)}, ${Math.round(b.x)})`);
    if (b.y < a.b - 1) problems.push(`${vp.name}: CTAs should stack at 390`);
  } else if (Math.abs(m.ctas[0].y - m.ctas[1].y) > 2) problems.push(`${vp.name}: CTAs should sit side by side`);
  await ctx.close();
}
await browser.close();
report(problems, 'hero h1-to-lede gap is on the type scale and the 390 CTAs are equal width');
