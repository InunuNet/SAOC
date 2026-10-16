#!/usr/bin/env node
// A-B: computed rest / hover / focus-visible / active styles of the four NavCards and the three ShowBand CTAs, at 1280,
// under no-preference motion. Hover is a real pointer hover (mouse.move), focus-visible is a real keyboard Tab.
// Transition durations must all be 150ms. Values come from goldens/f14/tokens.json (cited in f14-spec.md).
// Usage: BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/check-b-states.mjs
import { VIEWPORTS, SEL, COLOR_SRC, FX_SRC, fxMatches, fxStr, fxNeutral, SETTLE_MS, launch, newPage, openHome, loadGolden, missingHooks, durationsMs, report } from './_lib.mjs';

const T = loadGolden('tokens.json');
const problems = [];
const vp = VIEWPORTS[1];
const browser = await launch();
const { ctx, page } = await newPage(browser, vp, { reducedMotion: 'no-preference' });
await openHome(page);
problems.push(...(await missingHooks(page, { navCard: SEL.navCard, primary: SEL.cta('primary'), secondary: SEL.cta('secondary'), tertiary: SEL.cta('tertiary') }, 'states')));
if (problems.length) { await browser.close(); report(problems, ''); }

const read = (sel, i) => page.evaluate(`(() => { ${COLOR_SRC} ${FX_SRC}
  const el = document.querySelectorAll(${JSON.stringify(sel)})[${i}];
  const cs = getComputedStyle(el);
  const img = el.querySelector('img'), arrow = el.querySelector('[data-nav-card-arrow]'), title = el.querySelector('[data-nav-card-title]');
  const pick = (e) => e ? getComputedStyle(e) : null;
  return {
    fx: fx(cs), borderColor: cs.borderTopColor, borderWidth: cs.borderTopWidth, bg: cs.backgroundColor, color: cs.color,
    shadow: cs.boxShadow, tProp: cs.transitionProperty, tDur: cs.transitionDuration,
    outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor, outlineOffset: cs.outlineOffset,
    imgFx: img ? fx(pick(img)) : null, imgDur: img ? pick(img).transitionDuration : null, imgProp: img ? pick(img).transitionProperty : null,
    arrowFx: arrow ? fx(pick(arrow)) : null, arrowDur: arrow ? pick(arrow).transitionDuration : null, arrowProp: arrow ? pick(arrow).transitionProperty : null,
    titleLine: title ? pick(title).textDecorationLine : null, titleUnderline: title ? pick(title).textDecorationColor : null, titleColor: title ? pick(title).color : null,
  };
})()`);

const fxIs = (what, got, want) => { if (!fxMatches(got, want)) problems.push(`${what}: effective transform ${fxStr(got)}, want ${JSON.stringify(want)}`); };
const eq = (what, got, want) => { if (got !== want) problems.push(`${what}: got "${got}", want "${want}"`); };
const colorIs = async (what, got, want) => { const ok = await page.evaluate(`(() => { ${COLOR_SRC} return same(${JSON.stringify(got)}, ${JSON.stringify(want)}); })()`); if (!ok) problems.push(`${what}: colour "${got}" is not ${want}`); };
const allMs = (what, v) => { const d = durationsMs(v); if (!d.length || d.some((x) => Math.abs(x - T.motion.hoverMs) > 0.5)) problems.push(`${what}: transition-duration "${v}" must be ${T.motion.hoverMs}ms throughout`); };
const hasProps = (what, prop, need) => { const have = prop.split(',').map((s) => s.trim()); const alias = (n) => (n === 'transform' ? ['transform', 'translate', 'scale'] : [n]); const ok = have.includes('all') || need.every((n) => alias(n).some((a) => have.includes(a))); if (!ok) problems.push(`${what}: transition-property "${prop}" lacks ${need.join(', ')}`); };
const shadowOk = (what, v) => { for (const part of T.card.hoverShadowParts) if (!v.includes(part)) problems.push(`${what}: box-shadow "${v}" lacks "${part}"`); };

const count = await page.locator(SEL.navCard).count();
if (count !== 4) problems.push(`expected 4 nav cards, found ${count}`);
for (let i = 0; i < count; i++) {
  const sel = SEL.navCard; const tag = `card ${i + 1}`;
  const card = page.locator(sel).nth(i);
  await page.mouse.move(2, 2);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(SETTLE_MS);
  const rest = await read(sel, i);
  if (!fxNeutral(rest.fx)) problems.push(`${tag} rest transform not neutral: ${fxStr(rest.fx)}`);
  eq(`${tag} rest border-width`, rest.borderWidth, T.card.restBorderWidth);
  await colorIs(`${tag} rest border`, rest.borderColor, T.card.restBorder);
  await colorIs(`${tag} rest bg`, rest.bg, T.card.restBg);
  if (!fxNeutral(rest.imgFx)) problems.push(`${tag} rest image transform not neutral`);
  if (!fxNeutral(rest.arrowFx)) problems.push(`${tag} rest arrow transform not neutral`);
  allMs(`${tag} card`, rest.tDur); hasProps(`${tag} card`, rest.tProp, T.card.transitionProps.card);
  allMs(`${tag} image`, rest.imgDur); hasProps(`${tag} image`, rest.imgProp, T.card.transitionProps.image);
  allMs(`${tag} arrow`, rest.arrowDur); hasProps(`${tag} arrow`, rest.arrowProp, T.card.transitionProps.arrow);
  await colorIs(`${tag} rest title colour`, rest.titleColor, T.card.titleRestColor);

  await card.hover();
  await page.waitForTimeout(SETTLE_MS);
  const hov = await read(sel, i);
  fxIs(`${tag} hover`, hov.fx, T.card.hoverFx);
  await colorIs(`${tag} hover border`, hov.borderColor, T.card.hoverBorder);
  shadowOk(`${tag} hover`, hov.shadow);
  fxIs(`${tag} hover image`, hov.imgFx, T.card.hoverImageFx);
  fxIs(`${tag} hover arrow`, hov.arrowFx, T.card.hoverArrowFx);
  if (!String(hov.titleLine).includes('underline')) problems.push(`${tag} hover title not underlined (${hov.titleLine})`);
  await colorIs(`${tag} hover title underline`, hov.titleUnderline, T.card.hoverTitleUnderline);
  await colorIs(`${tag} hover title colour`, hov.titleColor, T.card.titleHoverColor);

  await page.mouse.down();
  await page.waitForTimeout(SETTLE_MS);
  const act = await read(sel, i);
  fxIs(`${tag} active`, act.fx, T.card.activeFx);
  await page.mouse.move(2, 2); // leave before release so the press does not navigate
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
}

// Keyboard focus-visible equals hover, plus a 2px outline.
await openHome(page);
for (let i = 0; i < count; i++) {
  const tag = `card ${i + 1}`;
  await page.mouse.move(2, 2);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.evaluate(() => window.scrollTo(0, 0));
  let focused = false;
  for (let n = 0; n < 120 && !focused; n++) {
    await page.keyboard.press('Tab');
    focused = await page.evaluate(`(() => { const a = document.activeElement; const cards = [...document.querySelectorAll(${JSON.stringify(SEL.navCard)})]; return cards.indexOf(a) === ${i}; })()`);
  }
  if (!focused) { problems.push(`${tag}: cannot reach by keyboard Tab`); continue; }
  await page.waitForTimeout(SETTLE_MS);
  const f = await read(SEL.navCard, i);
  fxIs(`${tag} focus`, f.fx, T.card.hoverFx);
  await colorIs(`${tag} focus border`, f.borderColor, T.card.hoverBorder);
  shadowOk(`${tag} focus`, f.shadow);
  fxIs(`${tag} focus image`, f.imgFx, T.card.hoverImageFx);
  fxIs(`${tag} focus arrow`, f.arrowFx, T.card.hoverArrowFx);
  if (!String(f.titleLine).includes('underline')) problems.push(`${tag} focus title not underlined`);
  eq(`${tag} focus outline-style`, f.outlineStyle, 'solid');
  eq(`${tag} focus outline-width`, f.outlineWidth, T.card.focusOutlineWidth);
  eq(`${tag} focus outline-offset`, f.outlineOffset, T.card.focusOutlineOffset);
  await colorIs(`${tag} focus outline colour`, f.outlineColor, T.card.focusOutlineColor);
}

// ShowBand CTAs.
const cta = (tier) => SEL.cta(tier);
const readCta = (tier) => page.evaluate(`(() => { ${COLOR_SRC} ${FX_SRC}
  const el = document.querySelector(${JSON.stringify(cta(tier))}); const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
  return { fx: fx(cs), bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, borderWidth: cs.borderTopWidth, tDur: cs.transitionDuration, tProp: cs.transitionProperty,
    line: cs.textDecorationLine, lineColor: cs.textDecorationColor, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor, outlineOffset: cs.outlineOffset,
    radius: cs.borderTopLeftRadius, fontSize: cs.fontSize, fontWeight: cs.fontWeight, h: r.height, w: r.width };
})()`);
for (const tier of ['primary', 'secondary', 'tertiary']) {
  const tag = `cta ${tier}`;
  const loc = page.locator(cta(tier));
  await loc.scrollIntoViewIfNeeded();
  await page.mouse.move(2, 2);
  await page.waitForTimeout(SETTLE_MS);
  const rest = await readCta(tier);
  allMs(tag, rest.tDur);
  if (!fxNeutral(rest.fx)) problems.push(`${tag} rest transform not neutral: ${fxStr(rest.fx)}`);
  eq(`${tag} font-size`, rest.fontSize, '14px');
  eq(`${tag} font-weight`, rest.fontWeight, '500');
  const spec = T.band[tier];
  if (tier === 'primary') {
    await colorIs(`${tag} rest bg`, rest.bg, spec.bg); await colorIs(`${tag} rest text`, rest.color, spec.color);
    hasProps(tag, rest.tProp, ['transform', 'background-color']);
    eq(`${tag} radius`, rest.radius, '2px');
  } else if (tier === 'secondary') {
    await colorIs(`${tag} rest bg`, rest.bg, spec.bg); await colorIs(`${tag} rest text`, rest.color, spec.color);
    eq(`${tag} border-width`, rest.borderWidth, '1px'); await colorIs(`${tag} rest border`, rest.border, spec.border);
    hasProps(tag, rest.tProp, ['transform', 'border-color']);
    eq(`${tag} radius`, rest.radius, '2px');
  } else {
    await colorIs(`${tag} rest text`, rest.color, spec.color);
    if (!String(rest.line).includes('underline')) problems.push(`${tag} rest must carry a persistent underline (${rest.line})`);
    await colorIs(`${tag} rest underline`, rest.lineColor, spec.underline);
  }
  await loc.hover(); await page.waitForTimeout(SETTLE_MS);
  const hov = await readCta(tier);
  if (tier === 'primary') { await colorIs(`${tag} hover bg`, hov.bg, spec.hoverBg); fxIs(`${tag} hover`, hov.fx, spec.hoverFx); }
  if (tier === 'secondary') { await colorIs(`${tag} hover border`, hov.border, spec.hoverBorder); await colorIs(`${tag} hover bg`, hov.bg, spec.hoverBg); fxIs(`${tag} hover`, hov.fx, spec.hoverFx); }
  if (tier === 'tertiary') { await colorIs(`${tag} hover text`, hov.color, spec.hoverColor); await colorIs(`${tag} hover underline`, hov.lineColor, spec.hoverUnderline); }
  await page.mouse.move(2, 2);
  // keyboard focus-visible
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.evaluate(() => window.scrollTo(0, 0));
  let focused = false;
  for (let n = 0; n < 160 && !focused; n++) {
    await page.keyboard.press('Tab');
    focused = await page.evaluate(`document.activeElement === document.querySelector(${JSON.stringify(cta(tier))})`);
  }
  if (!focused) { problems.push(`${tag}: cannot reach by keyboard Tab`); continue; }
  await page.waitForTimeout(SETTLE_MS);
  const f = await readCta(tier);
  eq(`${tag} focus outline-style`, f.outlineStyle, 'solid');
  eq(`${tag} focus outline-width`, f.outlineWidth, T.band.focusOutlineWidth);
  eq(`${tag} focus outline-offset`, f.outlineOffset, T.band.focusOutlineOffset);
  await colorIs(`${tag} focus outline colour`, f.outlineColor, T.band.focusOutlineColor);
  if (tier === 'primary') fxIs(`${tag} focus equals hover`, f.fx, spec.hoverFx);
}

await browser.close();
report(problems, `4 cards and 3 CTAs match rest/hover/focus-visible/active targets at 1280, all transitions ${T.motion.hoverMs}ms`);
