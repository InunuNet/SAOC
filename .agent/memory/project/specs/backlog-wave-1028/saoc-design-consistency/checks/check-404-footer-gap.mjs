// F1c A13 (NOS Design beta check): on the SAOC /404 the hero/band ran straight into the dark footer.
// Gate: a parchment (light) gap of at least 64px between the band's bottom and the footer's top at 390, 1440 and 2056.
import { withSite, openPage, check, finish, lum } from './lib.mjs';
const MIN_GAP = 64;
const PROBE = `() => { const f = document.querySelector('footer'); const m = document.querySelector('main'); if (!f || !m) return null;
  let bottom = 0; for (const e of m.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (r.height > 0 && r.width > 0) bottom = Math.max(bottom, r.bottom + scrollY); }
  const band = m.lastElementChild ? m.lastElementChild.getBoundingClientRect().bottom + scrollY : bottom; bottom = Math.max(bottom, band);
  const ft = f.getBoundingClientRect().top + scrollY; const gap = ft - bottom;
  let colour = null; if (gap > 2) { scrollTo(0, Math.max(0, bottom + gap / 2 - innerHeight / 2)); let el = document.elementFromPoint(innerWidth / 2, bottom + gap / 2 - scrollY); while (el) { const c = getComputedStyle(el).backgroundColor; if (!/rgba?\\(0, 0, 0, 0\\)|transparent/.test(c)) { colour = c; break; } el = el.parentElement; } }
  return { gap, colour }; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [390, 1440, 2056]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/this-page-does-not-exist-sdc', width);
    const r = await page.evaluate(`(${PROBE})()`); const w = `/404@${width}`;
    if (!r) { check(false, `${w}: no main/footer`); await ctx.close(); continue; }
    check(r.gap >= MIN_GAP - 0.5, `${w}: gap between the band and the footer is ${r.gap.toFixed(0)}px, want >=${MIN_GAP}px`);
    if (r.colour) { const [rr, g, b] = r.colour.match(/[\d.]+/g).map(Number); check(lum([rr, g, b]) > 0.6, `${w}: the gap is ${r.colour}, want parchment (light)`); }
    await ctx.close();
  }
});
finish('404-footer-gap');
