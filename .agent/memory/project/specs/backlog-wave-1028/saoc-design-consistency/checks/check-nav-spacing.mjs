// F1b (NOS Design confirmed): at 1280 and 1383 the Menu is icon-only with aria-label="Menu" and a target >= 44x44; logo.right + 24 <= nav.left;
// >= 12px between nav, Join CTA and Menu; one row; scrollWidth == clientWidth. At 1384+ the Menu is hidden (unchanged full row).
import { withSite, openPage, check, finish } from './lib.mjs';
const PROBE = `() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width > 0 ? { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height } : null; };
  const menu = document.querySelector('[data-hd=menu]'); const de = document.documentElement; const bar = document.querySelector('[data-hd=bar]');
  return { brand: r('[data-hd=brand]'), nav: r('[data-hd=nav]'), cta: r('[data-hd=cta]'), menu: r('[data-hd=menu]'), label: menu ? menu.getAttribute('aria-label') : null, docOver: de.scrollWidth - de.clientWidth, barOver: bar.scrollWidth - bar.clientWidth }; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1280, 1383]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width, 900);
    const r = await page.evaluate(`(${PROBE})()`); const w = `@${width}`;
    if (!r.nav || !r.brand || !r.cta || !r.menu) { check(false, `${w}: missing part (brand ${!!r.brand}, nav ${!!r.nav}, cta ${!!r.cta}, menu ${!!r.menu})`); await ctx.close(); continue; }
    check(r.brand.r + 24 <= r.nav.l + 0.5, `${w}: logo.right+24 (${(r.brand.r + 24).toFixed(1)}) > nav.left (${r.nav.l.toFixed(1)})`);
    check(r.cta.l - r.nav.r >= 12 - 0.5, `${w}: gap nav->CTA ${(r.cta.l - r.nav.r).toFixed(1)}px, want >=12`);
    check(r.menu.l - r.cta.r >= 12 - 0.5, `${w}: gap CTA->Menu ${(r.menu.l - r.cta.r).toFixed(1)}px, want >=12`);
    check(r.label === 'Menu', `${w}: Menu aria-label is "${r.label}", want "Menu"`);
    check(r.menu.w >= 44 && r.menu.h >= 44, `${w}: Menu target ${r.menu.w.toFixed(0)}x${r.menu.h.toFixed(0)}, want >=44x44`);
    check(r.menu.w <= 48, `${w}: Menu is ${r.menu.w.toFixed(0)}px wide, must be icon-only (<=48)`);
    const mids = [r.brand, r.nav, r.cta, r.menu].map((p) => (p.t + p.b) / 2); check(Math.max(...mids) - Math.min(...mids) <= 12, `${w}: not one row`);
    check(r.docOver <= 0 && r.barOver <= 0, `${w}: horizontal overflow (doc ${r.docOver}, bar ${r.barOver})`);
    await ctx.close();
  }
  const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', 1384, 900);
  check(await page.evaluate(() => { const m = document.querySelector('[data-hd=menu]'); return !m || m.getBoundingClientRect().width === 0; }), '@1384: Menu button must stay hidden (full row unchanged)');
  await ctx.close();
});
finish('nav-spacing');
