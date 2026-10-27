// F1b (SA-1): from 1280 the primary nav is inline and logo + nav + CTA (+ any control) sit on ONE row with no overlap,
// the logo keeps its 405px width, and nothing scrolls sideways. Also guards the Menu-only widths below 1280 and the full
// 7-item row at 1384+. Natural widths measured on main are in goldens/nav-widths.md.
import { withSite, openPage, check, finish } from './lib.mjs';
const PROBE = `() => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const bar = document.querySelector('[data-hd=bar]');
  const parts = [...bar.querySelectorAll('[data-hd=brand],[data-hd=nav],[data-hd=search],[data-hd=cta],[data-hd=menu]')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { n: e.dataset.hd, l: r.left, r: r.right, t: r.top, b: r.bottom }; });
  const items = [...document.querySelectorAll('[data-hd=nav] [data-hd=item]')].filter(vis).map((e) => e.textContent.trim());
  const de = document.documentElement; return { parts, items, brand: document.querySelector('[data-hd=brand]').getBoundingClientRect().width, docOver: de.scrollWidth - de.clientWidth, barOver: bar.scrollWidth - bar.clientWidth }; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1100, 1279, 1280, 1366, 1384, 1440]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width, 900);
    const r = await page.evaluate(`(${PROBE})()`);
    const where = `@${width}`;
    if (width >= 1280) check(r.items.length >= 5, `${where}: only ${r.items.length} inline nav items visible (want >=5; the full 7 from 1384)`);
    if (width >= 1384) check(r.items.length === 7, `${where}: ${r.items.length} inline items, want all 7`);
    if (width < 1280) check(r.items.length === 0, `${where}: inline nav visible below the threshold`);
    const tops = r.parts.map((p) => (p.t + p.b) / 2); const mid = tops.reduce((a, b) => a + b, 0) / (tops.length || 1);
    check(r.parts.every((p) => Math.abs((p.t + p.b) / 2 - mid) <= 12), `${where}: header controls are not on one row (centres ${tops.map((t) => t.toFixed(0)).join(',')})`);
    const sorted = [...r.parts].sort((a, b) => a.l - b.l);
    for (let i = 1; i < sorted.length; i++) check(sorted[i].l >= sorted[i - 1].r - 0.5, `${where}: ${sorted[i - 1].n} overlaps ${sorted[i].n}`);
    check(r.docOver <= 0 && r.barOver <= 0, `${where}: horizontal overflow (doc ${r.docOver}, bar ${r.barOver})`);
    check(Math.abs(r.brand - 405) <= 0.5, `${where}: logo is ${r.brand.toFixed(1)}px wide, must stay 405 (no shrink)`);
    await ctx.close();
  }
});
finish('nav-one-row');
