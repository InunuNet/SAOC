// D: one NOS logo per viewport at the top of each NOS page (header only), at 1280 and 390.
// A "logo" is any rendered, in-viewport img/svg[role=img]/picture whose src, alt or label names the
// show lockup / emblem. Strict on the hub too (scope amendment: the hub hero's own lockup is removed in F1,
// HANDOFF "Hub hero": "No lockup in the hero"); NOS_D_HUB_STRICT=0 makes the hub report-only. The Disa emblem motif (disa-graminifolia-emblem.svg) is page
// imagery, not a lockup, and is not counted.
import { HUB, IN_PAGE_HELPERS, NOS_ROUTES, VP_DESKTOP, VP_PHONE, main, openPage, withBrowser } from './_lib.mjs';

const STRICT_HUB = process.env.NOS_D_HUB_STRICT !== '0';

await main('D one-logo', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const [vpName, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page } = await openPage(browser, vp, route);
        await page.evaluate(IN_PAGE_HELPERS);
        const found = await page.evaluate(() => {
          const re = /lockup|logo|nos-20|nos-(full|reversed)|saoc-(emblem|logo)|national orchid show, western cape|data-nos-(masthead|colophon)/i;
          const roots = new Set();
          for (const el of document.querySelectorAll('img, picture, svg[role="img"], svg[aria-label], [data-nos-masthead], [data-nos-colophon]')) {
            const probe = [el.getAttribute('src'), el.currentSrc, el.getAttribute('alt'), el.getAttribute('aria-label'), el.getAttribute('class'), el.getAttribute('data-nos-masthead') !== null ? 'logo' : ''].join(' ');
            const img = el.tagName === 'PICTURE' ? el.querySelector('img') : el;
            const probe2 = img ? [img.getAttribute('src'), img.currentSrc, img.getAttribute('alt')].join(' ') : '';
            if (!re.test(probe + ' ' + probe2)) continue;
            if (!window.__vis(el.tagName === 'PICTURE' && img ? img : el, true)) continue;
            roots.add(el.closest('picture') ?? el);
          }
          return [...roots].map((el) => {
            const img = el.tagName === 'PICTURE' ? el.querySelector('img') : el;
            return `${el.tagName.toLowerCase()}:${(img?.getAttribute('src') ?? img?.getAttribute('aria-label') ?? el.className?.baseVal ?? el.className ?? '').toString().slice(0, 90)}`;
          });
        });
        // Measure the INK box, not the <img> box: the approved CSS (C:34) pulls the transparent padding back with
        // negative margins, so the img rect may start off-screen while the ink is fully visible. Header file ink
        // is (54,54)-(1139,241) of 1200x294 (H:86), scaled to the rendered width.
        const header = await page.evaluate(() => {
          const el = document.querySelector('#nh .nh-brand img');
          if (!el) return false;
          const b = el.getBoundingClientRect();
          const k = b.width / 1200;
          const ink = { l: b.left + 54 * k, t: b.top + 54 * k, r: b.left + 1139 * k, bt: b.top + 241 * k };
          return b.width > 0 && ink.t >= 0 && ink.bt <= innerHeight && ink.l >= 0 && ink.r <= innerWidth;
        });
        const tag = `${route} @${vpName}`;
        const hubSoft = route === HUB && !STRICT_HUB;
        const problems = [];
        if (!header) problems.push('header lockup ink not fully visible in the first screen');
        if (found.length !== 1) problems.push(`${found.length} logos in viewport: ${JSON.stringify(found)}`);
        for (const p of problems) {
          if (hubSoft) console.log(`  (report-only, hub hero = F2) ${tag}: ${p}`);
          else r.fail(`${tag}: ${p}`);
        }
        await ctx.close();
      }
    }
  });
});
