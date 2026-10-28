// F1c A8 (NOS Design ruling "SA-6: /about hero at 1024 and 1280"): heights of the 8 non-exempt routes at 1024 and 1280. The lock is 480 +-4 for all 8
// at both widths. FALLBACK (only if /about still wraps at 1024 after levers 1-4): lock 1280 for all 8 and 1024 for the other 7, and /about@1024 is
// measured and reported for NOS Design to rule by eye. This script ENFORCES whichever case applies and PRINTS which one:
//   CASE A  all 8 routes within 480 +-4 at 1024 and 1280  -> locked everywhere
//   CASE B  only /about@1024 is out of tolerance           -> 1280 locked for all 8, 1024 locked for the other 7, /about@1024 value reported (exit 0 for that cell)
// Anything else (any route out at 1280, or any other route out at 1024) fails. A screenshot of /about@1024 is written when DC_SHOT_DIR is set.
import { withSite, openPage, check, finish, INNER_ROUTES } from './lib.mjs';
const LOCK = 480; const TOL = 4; let aboutOut1024 = null;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1024, 1280]) {
    const rows = [];
    for (const path of INNER_ROUTES) {
      const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width);
      check(status === 200, `${path}@${width} status ${status}`);
      const h = await page.evaluate(() => { const e = document.querySelector('[data-page-hero]'); return e ? Math.round(e.getBoundingClientRect().height) : null; });
      check(h !== null, `${path}@${width}: no [data-page-hero]`);
      if (h !== null) {
        rows.push(`${path}=${h}`);
        const out = Math.abs(h - LOCK) > TOL;
        if (out && path === '/about' && width === 1024) { aboutOut1024 = h; if (process.env.DC_SHOT_DIR) await page.screenshot({ path: `${process.env.DC_SHOT_DIR}/about-1024.png`, clip: { x: 0, y: 97, width: 1024, height: Math.min(h, 800) } }); }
        else check(!out, `${path}@${width}: hero is ${h}px, want ${LOCK} +-${TOL}`);
      }
      await ctx.close();
    }
    console.log(`REPORT @${width}: ${rows.join(' ')}`);
  }
});
console.log(aboutOut1024 === null ? 'CASE A: all 8 routes locked at 1024 and 1280' : `CASE B (fallback): 1280 locked for all 8, 1024 locked for 7; /about@1024 = ${aboutOut1024}px, NOS Design to rule by eye`);
finish('hero-heights-report');
