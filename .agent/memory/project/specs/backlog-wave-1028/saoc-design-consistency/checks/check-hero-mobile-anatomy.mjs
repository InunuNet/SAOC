// F1c (mobile, below 768 height is content-driven so there is no equal-height gate): every route that has a photo uses ONE fixed band
// aspect-ratio (the current PageHero value, 2/1, +-0.02) and every route's copy block uses ONE padding (the current PageHero value, py 40px)
// at 390 and 600. Guards against per-route aspect or padding overrides.
import { withSite, openPage, check, finish, INNER_ROUTES } from './lib.mjs';
const BAND = 2; const PAD = '40px/40px';
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [390, 600]) for (const path of INNER_ROUTES) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width);
    check(status === 200, `${path}@${width} status ${status}`);
    const r = await page.evaluate(() => { const hero = document.querySelector('[data-page-hero]'); if (!hero) return null; const m = hero.querySelector('[data-page-hero-media]'); const c = getComputedStyle(hero.querySelector('[data-page-hero-copy]')); const b = m && m.getBoundingClientRect();
      return { ratio: b ? b.width / b.height : null, pad: c.paddingTop + '/' + c.paddingBottom }; });
    check(r !== null, `${path}@${width}: no [data-page-hero]`);
    if (!r) { await ctx.close(); continue; }
    if (r.ratio !== null) check(Math.abs(r.ratio - BAND) <= 0.02, `${path}@${width}: photo band ratio ${r.ratio.toFixed(3)}, want ${BAND}`);
    check(r.pad === PAD, `${path}@${width}: copy padding ${r.pad}, want ${PAD}`);
    await ctx.close();
  }
});
finish('hero-mobile-anatomy');
