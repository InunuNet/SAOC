#!/usr/bin/env node
// A-C: under prefers-reduced-motion: reduce, hovering or focusing every NavCard and ShowBand CTA applies NO transform
// (card, image, arrow, CTA lift all `none`) while the non-motion state change survives (border colour, underline,
// background) so the interaction is still perceivable. Control: with no-preference the transform IS applied (check-b).
// Also asserts the F14 elements add no running animation under reduce.
// Usage: BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/check-c-reduced-motion.mjs
import { VIEWPORTS, SEL, COLOR_SRC, FX_SRC, fxStr, fxNeutral, SETTLE_MS, launch, newPage, openHome, loadGolden, missingHooks, report } from './_lib.mjs';

const T = loadGolden('tokens.json');
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1], { reducedMotion: 'reduce' });
await openHome(page);
problems.push(...(await missingHooks(page, { navCard: SEL.navCard, primary: SEL.cta('primary') }, 'reduced-motion')));
if (problems.length) { await browser.close(); report(problems, ''); }

const cardState = (i) => page.evaluate(`(() => { ${COLOR_SRC} ${FX_SRC}
  const el = document.querySelectorAll(${JSON.stringify(SEL.navCard)})[${i}];
  const g = (e) => e ? getComputedStyle(e) : null;
  const t = el.querySelector('[data-nav-card-title]');
  return { card: fx(g(el)), img: fx(g(el.querySelector('img'))), arrow: fx(g(el.querySelector('[data-nav-card-arrow]'))),
    border: g(el).borderTopColor, underline: g(t).textDecorationColor, line: g(t).textDecorationLine };
})()`);
const ctaState = (tier) => page.evaluate(`(() => { ${FX_SRC} const el = document.querySelector(${JSON.stringify(SEL.cta(tier))}); const c = getComputedStyle(el); return { t: fx(c), bg: c.backgroundColor, border: c.borderTopColor, color: c.color, lineColor: c.textDecorationColor }; })()`);
const colorIs = (got, want) => page.evaluate(`(() => { ${COLOR_SRC} return same(${JSON.stringify(got)}, ${JSON.stringify(want)}); })()`);

const n = await page.locator(SEL.navCard).count();
for (let i = 0; i < n; i++) {
  const card = page.locator(SEL.navCard).nth(i);
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(SETTLE_MS);
  const h = await cardState(i);
  for (const k of ['card', 'img', 'arrow']) if (!fxNeutral(h[k])) problems.push(`card ${i + 1} hover (reduce): ${k} transform is ${fxStr(h[k])}, must be neutral`);
  if (!(await colorIs(h.border, T.card.hoverBorder))) problems.push(`card ${i + 1} hover (reduce): border colour did not change to brass (${h.border})`);
  if (!String(h.line).includes('underline') || !(await colorIs(h.underline, T.card.hoverTitleUnderline))) problems.push(`card ${i + 1} hover (reduce): brass title underline missing`);
  await page.mouse.move(2, 2);
}
// keyboard focus under reduce: outline still present, no transform
await page.evaluate(() => window.scrollTo(0, 0));
let focused = false;
for (let k = 0; k < 120 && !focused; k++) {
  await page.keyboard.press('Tab');
  focused = await page.evaluate(`document.activeElement === document.querySelectorAll(${JSON.stringify(SEL.navCard)})[0]`);
}
if (!focused) problems.push('reduce: first card not reachable by Tab');
else {
  await page.waitForTimeout(SETTLE_MS);
  const f = await cardState(0);
  for (const k of ['card', 'img', 'arrow']) if (!fxNeutral(f[k])) problems.push(`card 1 focus (reduce): ${k} transform is ${fxStr(f[k])}`);
  const o = await page.evaluate(`(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle + ' ' + c.outlineWidth; })()`);
  if (o !== 'solid 2px') problems.push(`card 1 focus (reduce): outline lost (${o})`);
}
for (const tier of ['primary', 'secondary', 'tertiary']) {
  const loc = page.locator(SEL.cta(tier));
  await loc.scrollIntoViewIfNeeded();
  await page.mouse.move(2, 2); await page.waitForTimeout(SETTLE_MS);
  const rest = await ctaState(tier);
  await loc.hover(); await page.waitForTimeout(SETTLE_MS);
  const h = await ctaState(tier);
  if (!fxNeutral(h.t)) problems.push(`cta ${tier} hover (reduce): transform ${fxStr(h.t)}, must be neutral`);
  const changed = h.bg !== rest.bg || h.border !== rest.border || h.color !== rest.color || h.lineColor !== rest.lineColor;
  if (!changed) problems.push(`cta ${tier} hover (reduce): no colour change survived, the state is imperceptible`);
  await page.mouse.move(2, 2);
}
const running = await page.evaluate(`document.getAnimations().filter((a) => a.effect && a.effect.target && (a.effect.target.closest(${JSON.stringify(SEL.navSection)}) || a.effect.target.closest(${JSON.stringify(SEL.band)})) && a.effect.getComputedTiming().iterations === Infinity).length`);
if (running) problems.push(`reduce: ${running} infinite animation(s) inside the F14 sections`);
await browser.close();
report(problems, 'no transform on hover or focus under prefers-reduced-motion, colour/underline/outline states survive');
