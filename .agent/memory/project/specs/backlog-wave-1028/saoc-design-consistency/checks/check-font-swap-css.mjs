// F1e lever 2: every shipped @font-face is font-display: swap and the metric-matched fallback exists (next/font adjustFontFallback emits a '<family> Fallback' @font-face
// carrying size-adjust and ascent/descent-override). Reads the CSS the browser actually applied.
import { withSite, openPage, check, finish } from './lib.mjs';
await withSite(async ({ base, browser, ctxOpts }) => {
  const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', 1440);
  const rules = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } }).filter((r) => r.type === CSSRule.FONT_FACE_RULE).map((r) => ({ family: r.style.getPropertyValue('font-family').replace(/['"]/g, ''), display: r.style.getPropertyValue('font-display'), size: r.style.getPropertyValue('size-adjust'), src: r.style.getPropertyValue('src').slice(0, 40) })));
  const real = rules.filter((r) => /url\(/.test(r.src)); const fallbacks = rules.filter((r) => /local\(/.test(r.src) && r.size);
  check(real.length > 0, 'no shipped @font-face rules found');
  for (const r of real) check(r.display === 'swap', `${r.family}: font-display is "${r.display}", want swap`);
  const serif = real.find((r) => /crimson/i.test(r.family)); check(!!serif, 'no Crimson Pro @font-face found');
  if (serif) check(fallbacks.some((f) => /crimson/i.test(f.family)), 'no metric-matched fallback @font-face (size-adjust) for Crimson Pro');
  await ctx.close();
});
finish('font-swap-css');
