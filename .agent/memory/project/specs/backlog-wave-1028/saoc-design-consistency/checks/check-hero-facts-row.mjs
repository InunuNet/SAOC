// F1c (NOS Design ruling "SA-6: /about hero at 1024 and 1280", amended: option (b), 14ch band): on /about at 1024 and 1280 the facts are ONE row (dd tops +-1) and nothing overflows the copy column.
// Global `.hero-facts` levers (768-1439): column gap 24, dd nowrap, dd >= 24px, dt balanced wrap with <=3 lines, and dt max-width 14ch at 1024-1279 ONLY, 18ch at 768 and from 1280.
// At 768 only the levers are asserted (the row and overflow are not).
// Not allowed to force the fit: a wider copy column (48%). Scrim (NOS Design HM-5 ruling, final): the copy scrim is the eased ramp alpha 0@34 .06@38 .16@42 .32@45 .52@48 .70@50.5 .80@52 (%), and there is no
// scrim below 768 (the hero stacks). HM-5 also holds: the left 0-39% of the hero has alpha <= .1 (read off the ramp by linear interpolation).
import { withSite, openPage, check, finish } from './lib.mjs';
const RAMP = [[34, 0], [38, 0.06], [42, 0.16], [45, 0.32], [48, 0.52], [50.5, 0.7], [52, 0.8]];
const stopsOf = (bg) => [...bg.matchAll(/rgba?\(([^)]+)\)\s{0,3}([\d.]+)(%|px)/g)].map((m) => { const p = m[1].split(',').map((x) => parseFloat(x)); return { at: m[3] === '%' ? parseFloat(m[2]) : null, alpha: p.length > 3 ? p[3] : 1 }; });
const alphaAt = (stops, pct) => { let prev = { at: 0, alpha: 0 }; for (const s of stops) { if (s.at >= pct) return s.at === prev.at ? s.alpha : prev.alpha + (s.alpha - prev.alpha) / (s.at - prev.at) / (1 / (pct - prev.at)); prev = s; } return prev.alpha; };
const PROBE = (CH) => `() => { const hero = document.querySelector('[data-page-hero]'); const dl = hero && hero.querySelector('.hero-facts'); if (!dl) return null;
  const copy = hero.querySelector('[data-page-hero-copy]'); const cb = copy.getBoundingClientRect(); const hb = hero.getBoundingClientRect(); const dds = [...dl.querySelectorAll('dd')]; const dts = [...dl.querySelectorAll('dt')];
  const cs = getComputedStyle(dl); const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;width:${CH}ch;font:' + getComputedStyle(dts[0]).font; document.body.appendChild(probe); const chExp = probe.getBoundingClientRect().width; probe.remove();
  const scrim = hero.querySelector('[data-hero-scrim=copy]'); const sc = scrim ? getComputedStyle(scrim).backgroundImage : '';
  const lines = (e) => { const c = getComputedStyle(e); return e.getBoundingClientRect().height / (parseFloat(c.lineHeight) || parseFloat(c.fontSize) * 1.35); };
  return { tops: dds.map((d) => d.getBoundingClientRect().top), ddRight: Math.max(...dds.map((d) => d.getBoundingClientRect().right)), dtRight: Math.max(...dts.map((d) => d.getBoundingClientRect().right)), copyRight: cb.right, copyW: cb.width, heroW: hb.width,
    gap: cs.columnGap, dtMax: parseFloat(getComputedStyle(dts[0]).maxWidth), dtWrap: getComputedStyle(dts[0]).textWrap, chExp, dtLines: Math.max(...dts.map(lines)), ddWrap: getComputedStyle(dds[0]).whiteSpace, ddSize: Math.min(...dds.map((d) => parseFloat(getComputedStyle(d).fontSize))), scrim: sc, over: copy.scrollWidth - copy.clientWidth }; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [390, 600]) { // no scrim below 768
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width);
    const d = await page.evaluate(() => { const e = document.querySelector('[data-page-hero] [data-hero-scrim=copy]'); return e ? getComputedStyle(e).display : 'absent'; });
    check(d === 'none' || d === 'absent', `/about@${width}: the copy scrim is display ${d}, want none below 768`);
    await ctx.close();
  }
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
    const stops = stopsOf(r.scrim).filter((x) => x.at !== null);
    for (const [at, alpha] of RAMP) check(stops.some((x) => Math.abs(x.at - at) <= 0.1 && Math.abs(x.alpha - alpha) <= 0.005), `${w}: scrim has no stop alpha ${alpha} at ${at}% (stops: ${stops.map((x) => `${x.alpha}@${x.at}`).join(' ')})`);
    check(stops.length === RAMP.length + 1 || stops.length === RAMP.length, `${w}: scrim has ${stops.length} stops, want the ${RAMP.length}-stop HM-5 ramp`);
    check(Math.max(...stops.map((x) => x.alpha)) <= 0.8 + 0.005, `${w}: scrim alpha peaks above 0.8`);
    check(alphaAt(stops, 39) <= 0.1 && stops.filter((x) => x.at <= 39).every((x) => x.alpha <= 0.1), `${w}: HM-5: the left 0-39% of the hero has alpha ${alphaAt(stops, 39).toFixed(3)}, want <= .1`);
    await ctx.close();
  }
});
finish('hero-facts-row');
