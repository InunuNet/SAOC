// F1c A8 (NOS Design ruling "SA-6: /about hero at 1024 and 1280", amended): LOCK. All 8 non-exempt routes are 480 +-4 at 1024 and 1280, /about included. NOS Design accepted
// 1024 by eye with the 14ch facts band, so there is no fallback and no named allowance: any route out of tolerance at either width fails.
import { withSite, openPage, check, finish, INNER_ROUTES } from './lib.mjs';
const LOCK = 480; const TOL = 4;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1024, 1280]) {
    const rows = [];
    for (const path of INNER_ROUTES) {
      const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width);
      check(status === 200, `${path}@${width} status ${status}`);
      const h = await page.evaluate(() => { const e = document.querySelector('[data-page-hero]'); return e ? Math.round(e.getBoundingClientRect().height) : null; });
      check(h !== null, `${path}@${width}: no [data-page-hero]`);
      if (h !== null) { rows.push(`${path}=${h}`); check(Math.abs(h - LOCK) <= TOL, `${path}@${width}: hero is ${h}px, want ${LOCK} +-${TOL}`); }
      await ctx.close();
    }
    console.log(`REPORT @${width}: ${rows.join(' ')}`);
  }
});
finish('hero-heights-report');
