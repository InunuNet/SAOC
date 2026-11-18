#!/usr/bin/env node
// F19-A1 (R79 #1 / R64), updated 18 Nov for Brad's hero scale pass: the home hero has ONE scrim layer,
// [data-hero-scrim="copy"] (aria-hidden, absolutely positioned inset-0, a direct child of the carousel section,
// after the slides and before the copy). It is sage (--primary-800, #22281f) only:
//   from 1024px  a 90deg gradient, solid at .88 through the CTA row's right edge plus 48px (so the 11px mono
//                labels under the CTAs reach 4.5:1 on every slide), then easing to clear; alphas never rise along it;
//                at 1280 and wider the clear end sits inside the frame, so the right of the photograph is bare;
//   below 1024px an even wash of sage at .70-.85 behind the full-width copy (no gradient).
// The three-layer F19 scrim (diagonal, veil, bone) is gone. Contrast is measured by check-b-contrast.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-a-scrim.mjs
import { VIEWPORTS, WIDE, COLOR_SRC, launch, newPage, open, report } from './_lib.mjs';

const SOLID_ALPHA = 0.88;
const CTA_REACH_PX = 48;
const WASH_ALPHA = [0.7, 0.85];
const SAGE = { r: 34, g: 40, b: 31 };
const CHANNEL_TOLERANCE = 1; // the colour is read back from a canvas, which can round a channel by one
const MIN_CLEAR_END_WIDTH = 1280;
const problems = [];
const browser = await launch();

for (const vp of [...VIEWPORTS, WIDE]) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/');
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.count()) await pause.first().click();
  const info = await page.evaluate(`(() => {
    ${COLOR_SRC}
    const hero = document.querySelector('section[aria-roledescription="carousel"]');
    const hr = hero.getBoundingClientRect();
    const kids = [...hero.children];
    const layers = [...hero.querySelectorAll('[data-hero-scrim]')];
    const el = layers[0];
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const media = hero.querySelector('[data-home-hero-media]');
    const px = (expr) => { const p = document.createElement('div'); p.style.cssText = 'position:absolute;visibility:hidden;height:0;width:' + expr; el.appendChild(p); const w = p.getBoundingClientRect().width; p.remove(); return w; };
    const bi = cs.backgroundImage;
    const stops = bi.startsWith('linear-gradient(90deg, ')
      ? bi.slice('linear-gradient(90deg, '.length, -1).split(/, (?=rgba\\()/).map((part) => { const m = part.match(/^rgba\\((\\d+), (\\d+), (\\d+), ([0-9.]+)\\) (.*)$/s); return m ? { r: +m[1], g: +m[2], b: +m[3], a: parseFloat(m[4]), px: px(m[5]) } : null; })
      : [];
    return {
      names: layers.map((l) => l.getAttribute('data-hero-scrim')),
      ariaHidden: el.getAttribute('aria-hidden'), position: cs.position,
      direct: el.parentElement === hero, fills: Math.abs(r.width - hr.width) <= 1 && Math.abs(r.height - hr.height) <= 1,
      idx: kids.indexOf(el), mediaIdx: kids.indexOf(media), contentIdx: kids.indexOf(hero.querySelector('[data-hero-copy]')),
      bgImage: bi.startsWith('linear-gradient') ? 'gradient' : bi, bg: norm(cs.backgroundColor), stops,
      ctaRight: hero.querySelector('[data-hero-ctas]').getBoundingClientRect().right - hr.left, heroW: hr.width,
    };
  })()`);
  const tag = vp.name;
  if (info.names.join() !== 'copy') problems.push(`${tag}: want exactly one [data-hero-scrim="copy"] layer, found [${info.names}]`);
  if (info.ariaHidden !== 'true') problems.push(`${tag}: scrim must be aria-hidden`);
  if (!info.direct || info.position !== 'absolute' || !info.fills) problems.push(`${tag}: scrim must be an absolutely positioned inset-0 direct child of the carousel section`);
  if (!(info.mediaIdx < info.idx && info.idx < info.contentIdx)) problems.push(`${tag}: scrim must sit after the slides and before the copy (media ${info.mediaIdx}, scrim ${info.idx}, copy ${info.contentIdx})`);
  if (vp.width >= 1024) {
    const { stops } = info;
    const sage = (s) => s.r === SAGE.r && s.g === SAGE.g && s.b === SAGE.b;
    if (info.bgImage !== 'gradient' || stops.length < 6 || stops.some((s) => s === null)) problems.push(`${tag}: want a 90deg sage gradient on the scrim, got ${info.bgImage}`);
    else {
      if (!stops.every(sage)) problems.push(`${tag}: every scrim stop must be the --primary-800 sage`);
      if (stops[0].a !== SOLID_ALPHA || stops[1].a !== SOLID_ALPHA) problems.push(`${tag}: the scrim must start solid at ${SOLID_ALPHA}`);
      if (stops[stops.length - 1].a !== 0) problems.push(`${tag}: the scrim must end fully clear`);
      for (let i = 1; i < stops.length; i++) if (stops[i].a > stops[i - 1].a + 0.001) problems.push(`${tag}: scrim alpha rises at stop ${i + 1}`);
      if (stops[1].px < info.ctaRight + CTA_REACH_PX - 1) problems.push(`${tag}: solid zone ends at ${Math.round(stops[1].px)}px, the CTA row ends at ${Math.round(info.ctaRight)}px (want solid through +${CTA_REACH_PX}px)`);
      if (vp.width >= MIN_CLEAR_END_WIDTH && stops[stops.length - 1].px >= info.heroW) problems.push(`${tag}: the scrim runs to the right edge (clear at ${Math.round(stops[stops.length - 1].px)}px of ${Math.round(info.heroW)}px), so no bare photograph is left`);
    }
  } else {
    if (info.bgImage !== 'none') problems.push(`${tag}: below 1024px the scrim is an even wash, not a gradient (${info.bgImage})`);
    const { r, g, b, a } = info.bg;
    if ([r - SAGE.r, g - SAGE.g, b - SAGE.b].some((d) => Math.abs(d) > CHANNEL_TOLERANCE) || a < WASH_ALPHA[0] || a > WASH_ALPHA[1]) problems.push(`${tag}: wash is rgba(${r},${g},${b},${a}), want sage at ${WASH_ALPHA.join('-')}`);
  }
  await ctx.close();
}
await browser.close();
report(problems, 'one sage copy scrim: solid through the CTA row + 48px then clear from 1024px, an even wash below');
