// H: no horizontal scroll at 360, 375, 390 or 768 on any NOS page (documentElement.scrollWidth == clientWidth, and
// == innerWidth). 360 and 375 added by design-lead ruling 2026-10-15: the header lockup must shrink below 420px
// (C:89 `--nc-logo-w: min(390px, calc((100vw - 32px) / 0.904))`), so the custom property has to be declared on :root
// (or an ancestor the media query reaches), not shadowed on .nh.
import { NOS_ROUTES, main, openPage, withBrowser } from './_lib.mjs';

const WIDTHS = [360, 375, 390, 768];

await main('H no-hscroll', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const width of WIDTHS) {
        const { ctx, page, status } = await openPage(browser, { width, height: 900 }, route);
        if (status !== 200) r.fail(`${route} @${width}: HTTP ${status}`);
        const m = await page.evaluate(() => {
          const iw = innerWidth;
          const wide = [...document.querySelectorAll('body *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.right > iw + 1; }).slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)}`);
          return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, iw, wide };
        });
        if (m.sw !== m.cw || m.sw !== m.iw) r.fail(`${route} @${width}: scrollWidth ${m.sw}, clientWidth ${m.cw}, innerWidth ${m.iw}; offenders: ${m.wide.join(' | ')}`);
        await ctx.close();
      }
    }
  });
});
