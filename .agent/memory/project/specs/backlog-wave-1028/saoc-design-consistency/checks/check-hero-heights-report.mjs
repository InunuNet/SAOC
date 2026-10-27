// F1c REPORT-ONLY: prints the inner PageHero height per route at 1024 and 1280 (after the /about facts-dl fix NOS Design locks these once all 8
// routes agree within +-4). Never fails on a value; fails only if a route did not render or has no hero. Output is the record.
import { withSite, openPage, check, finish, INNER_ROUTES } from './lib.mjs';
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1024, 1280]) {
    const rows = [];
    for (const path of INNER_ROUTES) {
      const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width);
      check(status === 200, `${path}@${width} status ${status}`);
      const h = await page.evaluate(() => { const e = document.querySelector('[data-page-hero]'); return e ? Math.round(e.getBoundingClientRect().height) : null; });
      check(h !== null, `${path}@${width}: no [data-page-hero]`); rows.push(`${path}=${h}`); await ctx.close();
    }
    console.log(`REPORT @${width}: ${rows.join(' ')}`);
  }
});
finish('hero-heights-report');
