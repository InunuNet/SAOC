#!/usr/bin/env node
// A-F: contrast. Every rendered text node in the NavCards and ShowBand sections is >=4.5:1 against its composited
// background (>=3:1 when large: >=24px, or >=18.66px at weight >=700); translucent text and backgrounds are composited,
// the card badge over a worst-case white photo. CTA hover states are re-measured. UI components are >=3:1: card and
// CTA focus outlines against the surface they sit on, the primary fill and the secondary border against the band, and
// the tertiary underline against the band.
// Usage: BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/check-f-contrast.mjs
import { VIEWPORTS, SEL, COLOR_SRC, SETTLE_MS, launch, newPage, openHome, loadGolden, missingHooks, report } from './_lib.mjs';

const T = loadGolden('tokens.json');
const problems = [];
const browser = await launch();

const scanText = (selSection) => `(() => { ${COLOR_SRC}
  const sec = document.querySelector(${JSON.stringify(selSection)}); const out = [];
  const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const n = walker.currentNode; if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (seen.has(el)) continue; seen.add(el);
    const c = getComputedStyle(el); if (c.visibility === 'hidden' || c.display === 'none') continue;
    const bg = effectiveBg(el);
    const fg = over(norm(c.color), bg);
    const px = parseFloat(c.fontSize), w = parseInt(c.fontWeight, 10);
    const large = px >= ${T.contrast.largeTextMinPx} || (px >= 18.66 && w >= 700);
    out.push({ text: n.textContent.trim().slice(0, 28), ratio: Math.round(ratio(fg, bg) * 100) / 100, need: large ? ${T.contrast.largeText} : ${T.contrast.text} });
  }
  return out;
})()`;

for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp, { reducedMotion: 'no-preference' });
  await openHome(page);
  const miss = await missingHooks(page, { navSection: SEL.navSection, band: SEL.band, primary: SEL.cta('primary'), secondary: SEL.cta('secondary'), tertiary: SEL.cta('tertiary') }, vp.name);
  if (miss.length) { problems.push(...miss); await ctx.close(); continue; }
  for (const [label, sel] of [['nav', SEL.navSection], ['band', SEL.band], ['yearbook', '[data-home-section="yearbook"]'], ['partners', '[data-home-section="partners"]']]) {
    const rows = await page.evaluate(scanText(sel));
    if (rows.length < 3) problems.push(`${vp.name} ${label}: only ${rows.length} text nodes scanned`);
    for (const r of rows) if (r.ratio < r.need) problems.push(`${vp.name} ${label}: "${r.text}" ${r.ratio}:1 < ${r.need}:1`);
  }
  if (vp.name === '1280') {
    // hovered CTA text vs hovered fill
    for (const tier of ['primary', 'secondary', 'tertiary']) {
      const loc = page.locator(SEL.cta(tier));
      await loc.scrollIntoViewIfNeeded(); await loc.hover(); await page.waitForTimeout(SETTLE_MS);
      const r = await page.evaluate(`(() => { ${COLOR_SRC} const el = document.querySelector(${JSON.stringify(SEL.cta(tier))}); const bg = effectiveBg(el); const fg = over(norm(getComputedStyle(el).color), bg); return Math.round(ratio(fg, bg) * 100) / 100; })()`);
      if (r < T.contrast.text) problems.push(`1280 cta ${tier} hover: text ${r}:1 < ${T.contrast.text}:1`);
      await page.mouse.move(2, 2);
    }
    // UI components
    const ui = await page.evaluate(`(() => { ${COLOR_SRC}
      const band = document.querySelector(${JSON.stringify(SEL.band)}); const bandBg = effectiveBg(band);
      const get = (t) => document.querySelector('[data-show-band-cta="' + t + '"]');
      const cs = (e) => getComputedStyle(e);
      const prim = over(norm(cs(get('primary')).backgroundColor), bandBg);
      const secBorder = over(norm(cs(get('secondary')).borderTopColor), bandBg);
      const tertLine = over(norm(cs(get('tertiary')).textDecorationColor), bandBg);
      const navBg = effectiveBg(document.querySelector(${JSON.stringify(SEL.navSection)}));
      return { primaryFill: ratio(prim, bandBg), secondaryBorder: ratio(secBorder, bandBg), tertiaryUnderline: ratio(tertLine, bandBg),
        cardOutline: ratio(norm(${JSON.stringify(T.card.focusOutlineColor)}), navBg), ctaOutline: ratio(norm(${JSON.stringify(T.band.focusOutlineColor)}), bandBg) };
    })()`);
    for (const [k, v] of Object.entries(ui)) if (v < T.contrast.ui) problems.push(`1280 UI ${k}: ${v.toFixed(2)}:1 < ${T.contrast.ui}:1`);
  }
  await ctx.close();
}
await browser.close();
report(problems, 'all text >=4.5:1 (large >=3:1), CTA hover text >=4.5:1, UI components and focus outlines >=3:1');
