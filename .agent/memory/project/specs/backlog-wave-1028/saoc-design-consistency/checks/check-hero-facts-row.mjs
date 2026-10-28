// F1c (NOS Design ruling "SA-6: /about hero at 1024 and 1280", amended: option (b), 14ch band): on /about at 1024 and 1280 the facts are ONE row (dd tops +-1) and nothing overflows the copy column.
// Global `.hero-facts` levers (768-1439): column gap 24, dd nowrap, dd >= 24px, dt balanced wrap with <=3 lines, and dt max-width 14ch at 1024-1279 ONLY, 18ch at 768 and from 1280.
// At 768 only the levers are asserted (the row and overflow are not).
// Not allowed to force the fit: a wider copy column (48%) or a smaller scrim (clear to 44%, full by 52%, alpha 0.8).
import { withSite, openPage, check, finish } from './lib.mjs';
const PROBE = (CH) => `() => { const hero = document.querySelector('[data-page-hero]'); const dl = hero && hero.querySelector('.hero-facts'); if (!dl) return null;
  const copy = hero.querySelector('[data-page-hero-copy]'); const cb = copy.getBoundingClientRect(); const hb = hero.getBoundingClientRect(); const dds = [...dl.querySelectorAll('dd')]; const dts = [...dl.querySelectorAll('dt')];
  const cs = getComputedStyle(dl); const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;width:' + CH + 'ch;font:' + getComputedStyle(dts[0]).font; document.body.appendChild(probe); const chExp = probe.getBoundingClientRect().width; probe.remove();
  const scrim = hero.querySelector('[data-hero-scrim=copy]'); const sc = scrim ? getComputedStyle(scrim).backgroundImage : '';
  const lines = (e) => { const c = getComputedStyle(e); return e.getBoundingClientRect().height / (parseFloat(c.lineHeight) || parseFloat(c.fontSize) * 1.35); };
  return { tops: dds.map((d) => d.getBoundingClientRect().top), ddRight: Math.max(...dds.map((d) => d.getBoundingClientRect().right)), dtRight: Math.max(...dts.map((d) => d.getBoundingClientRect().right)), copyRight: cb.right, copyW: cb.width, heroW: hb.width,
    gap: cs.columnGap, dtMax: parseFloat(getComputedStyle(dts[0]).maxWidth), dtWrap: getComputedStyle(dts[0]).textWrap, chExp, dtLines: Math.max(...dts.map(lines)), ddWrap: getComputedStyle(dds[0]).whiteSpace, ddSize: Math.min(...dds.map((d) => parseFloat(getComputedStyle(d).fontSize))), scrim: sc, over: copy.scrollWidth - copy.clientWidth }; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [768, 1024, 1280]) {
    const ch = width >= 1024 && width <= 1279 ? 14 : 18; const rowGate = width >= 1024;
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, '/about', width); const w = `/about@${width}`; check(status === 200, `${w} status ${status}`);
    const r = await page.evaluate(`(${PROBE(ch)})()`);
    if (!r) { check(false, `${w}: no .hero-facts`); await ctx.close(); continue; }
    const spread = Math.max(...r.tops) - Math.min(...r.tops);
    if (rowGate) check(spread <= 1, `${w}: dd tops differ by ${spread.toFixed(1)}px, want one row (+-1)`);
    if (rowGate) check(r.ddRight <= r.copyRight + 0.5 && r.dtRight <= r.copyRight + 0.5 && r.over <= 0, `${w}: a fact overflows the copy column (dd right ${r.ddRight.toFixed(0)}, dt right ${r.dtRight.toFixed(0)}, column right ${r.copyRight.toFixed(0)}, scroll overflow ${r.over})`);
    check(r.gap === '24px', `${w}: .hero-facts column gap is ${r.gap}, want 24px (lever 1)`);
    check(Math.abs(r.dtMax - r.chExp) <= 1, `${w}: dt max-width is ${r.dtMax.toFixed(0)}px, want exactly ${ch}ch (${r.chExp.toFixed(0)}px) (lever 2)`);
    check(/balance/.test(r.dtWrap), `${w}: dt text-wrap is ${r.dtWrap}, want balance`);
    check(r.dtLines <= 3.05, `${w}: dt wraps to ${r.dtLines.toFixed(1)} lines, want <=3`);
    check(r.ddSize >= 24 - 0.01, `${w}: dd is ${r.ddSize.toFixed(1)}px, floor is 24px (lever 3)`);
    check(r.ddWrap === 'nowrap', `${w}: dd white-space is ${r.ddWrap}, want nowrap (lever 4)`);
    check(Math.abs(r.copyW / r.heroW - 0.48) <= 0.005, `${w}: copy column is ${(100 * r.copyW / r.heroW).toFixed(1)}% of the hero, must stay 48% (no widening)`);
    check(r.scrim.includes('44%') && r.scrim.includes('52%') && /0\.8\)/.test(r.scrim), `${w}: scrim gradient changed (want clear to 44%, full by 52%, alpha 0.8): ${r.scrim.slice(0, 120)}`);
    await ctx.close();
  }
});
finish('hero-facts-row');
