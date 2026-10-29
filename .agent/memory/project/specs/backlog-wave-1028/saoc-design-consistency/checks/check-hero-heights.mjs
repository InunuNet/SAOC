// F1c (SA-6, NOS Design confirmed): inner PageHero is LOCKED at 480 +-4 at 1440 and 2056 on the 8 non-exempt routes, and 768 (all 8 routes, /about included, no exception).
// 1024 and 1280 are report-only (check-hero-heights-report.mjs) until NOS Design locks them. Copy padding is identical on every route.
// Exempt (PG-1): Home, Events list, Societies grid, Contact, 404, and /media-kit (gated tool page, typographic header, no photo hero).
import { withSite, openPage, check, finish, INNER_ROUTES } from './lib.mjs';
const LOCKED = { 768: 480, 1440: 480, 2056: 480 };
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [768, 1440, 2056]) {
    const rows = [];
    for (const path of INNER_ROUTES) {
      const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width);
      check(status === 200, `${path}@${width} status ${status}`);
      const r = await page.evaluate(() => { const h = document.querySelector('[data-page-hero]'); if (!h) return null; const c = getComputedStyle(h.querySelector('[data-page-hero-copy]')); return { h: h.getBoundingClientRect().height, pad: c.paddingTop + '/' + c.paddingBottom }; });
      check(r !== null, `${path}@${width}: no [data-page-hero]`);
      if (r) rows.push({ path, ...r });
      await ctx.close();
    }
    if (!rows.length) continue;
    const hs = rows.map((x) => x.h); const spread = Math.max(...hs) - Math.min(...hs);
    check(spread <= 4, `@${width}: hero heights differ by ${spread.toFixed(0)}px (${rows.map((x) => `${x.path}=${x.h.toFixed(0)}`).join(' ')}), want <=4`);
    check(new Set(rows.map((x) => x.pad)).size === 1, `@${width}: copy padding differs between routes (${[...new Set(rows.map((x) => x.pad))].join(' | ')}); height must not be equalised by padding`);
    if (LOCKED[width]) for (const x of rows) check(Math.abs(x.h - LOCKED[width]) <= 4, `${x.path}@${width}: ${x.h.toFixed(0)}px, locked value is ${LOCKED[width]}`);
  }
});
finish('hero-heights');
