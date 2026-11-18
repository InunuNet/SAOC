#!/usr/bin/env node
// F19-A6 (R80 #2), updated 18 Nov for Brad's hero scale pass. The home hero is an overlay at every width (the photograph
// behind the copy), so on phones and desktops alike:
//   - the h1 is inside the first screen (320x568, 375x667, 390x844, 430x932, 1280x900);
//   - below 1024px the three CTAs (data-hero-cta) stack at the same full width, each >= 44px tall;
//     from 1024px they sit side by side and the three columns keep >= 16px between them, each mono label inside its column;
//   - the carousel controls (the 44px pause button and eight slide buttons) all fit inside the copy column, every
//     slide button is >= 24px wide and tall (WCAG 2.2 target size), and the pause button is >= 44px.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-f-hero-mobile.mjs
import { launch, newPage, open, report } from './_lib.mjs';

const VIEWPORTS = [
  { name: '320', width: 320, height: 568, isMobile: true },
  { name: '375', width: 375, height: 667, isMobile: true },
  { name: '390', width: 390, height: 844, isMobile: true },
  { name: '430', width: 430, height: 932, isMobile: true },
  { name: '1280', width: 1280, height: 900, isMobile: false },
];
const DESKTOP_FROM = 1024;
const MIN_TAP = 44;
const MIN_TARGET = 24;
const MIN_COLUMN_GAP = 16;
const CONTROL_COUNT = 9;
const problems = [];
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/');
  const m = await page.evaluate(() => {
    const hero = document.querySelector('section[aria-roledescription="carousel"]');
    const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, b: r.bottom, w: r.width, h: r.height, r: r.right }; };
    const copy = hero.querySelector('[data-hero-copy]');
    const cs = getComputedStyle(copy);
    return {
      h1: R(hero.querySelector('h1')), wrap: R(hero.querySelector('[data-hero-ctas]')),
      ctas: [...hero.querySelectorAll('[data-hero-cta]')].map(R),
      cols: [...hero.querySelectorAll('[data-hero-ctas] > div')].map(R),
      metas: [...hero.querySelectorAll('[data-hero-ctas] p')].map(R),
      controls: [...hero.querySelectorAll('[data-hero-controls] button')].map(R),
      contentRight: copy.getBoundingClientRect().right - parseFloat(cs.paddingRight), vh: innerHeight,
    };
  });
  const tag = vp.name;
  if (m.h1.b > m.vh) problems.push(`${tag}: the h1 ends at ${Math.round(m.h1.b)}px, below the first screen (${m.vh}px)`);
  if (m.ctas.length !== 3) { problems.push(`${tag}: want 3 hero CTAs, found ${m.ctas.length}`); await ctx.close(); continue; }
  m.ctas.forEach((c, i) => { if (c.h < MIN_TAP) problems.push(`${tag}: hero CTA ${i + 1} is ${Math.round(c.h)}px tall (< ${MIN_TAP})`); });
  if (vp.width < DESKTOP_FROM) {
    if (m.ctas.some((c) => Math.abs(c.w - m.wrap.w) > 1)) problems.push(`${tag}: the CTAs must all be the full content width (${Math.round(m.wrap.w)}px)`);
    if (m.ctas[1].y < m.ctas[0].b - 1 || m.ctas[2].y < m.ctas[1].b - 1) problems.push(`${tag}: the CTAs should stack`);
  } else {
    if (m.ctas.some((c) => Math.abs(c.y - m.ctas[0].y) > 2)) problems.push(`${tag}: the CTAs should sit side by side`);
    for (let i = 1; i < m.cols.length; i++) {
      const gap = m.cols[i].x - m.cols[i - 1].r;
      if (gap < MIN_COLUMN_GAP - 0.5) problems.push(`${tag}: columns ${i} and ${i + 1} are ${Math.round(gap)}px apart (< ${MIN_COLUMN_GAP})`);
    }
    m.metas.forEach((p, i) => { if (p.r > m.cols[i].r + 0.5) problems.push(`${tag}: mono label ${i + 1} runs past its column`); });
  }
  if (m.controls.length !== CONTROL_COUNT) problems.push(`${tag}: want ${CONTROL_COUNT} carousel controls, found ${m.controls.length}`);
  m.controls.forEach((c, i) => {
    const min = i === 0 ? MIN_TAP : MIN_TARGET;
    if (c.w < min - 0.5 || c.h < min - 0.5) problems.push(`${tag}: control ${i + 1} is ${Math.round(c.w)}x${Math.round(c.h)}px (< ${min})`);
    if (c.r > m.contentRight + 0.5) problems.push(`${tag}: control ${i + 1} ends at ${Math.round(c.r)}px, past the content edge ${Math.round(m.contentRight)}px`);
  });
  await ctx.close();
}
await browser.close();
report(problems, 'the h1 is in the first screen, the CTAs stack or sit in 16px-gapped columns, and all nine carousel controls fit from 320 to 1280');
