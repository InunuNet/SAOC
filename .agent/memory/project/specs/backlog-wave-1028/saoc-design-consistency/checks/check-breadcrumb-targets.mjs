// F1a: breadcrumb link targets are at least 24x24 CSS px (WCAG 2.5.8) at 390 and 1440 on every interior route that has one.
import { withSite, openPage, check, finish } from './lib.mjs';
const ROUTES = ['/about', '/judging', '/sponsors', '/members', '/privacy', '/terms'];
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [390, 1440]) for (const path of ROUTES) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width);
    check(status === 200, `${path}@${width} status ${status}`);
    const boxes = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Breadcrumb"] a')].map((a) => { const r = a.getBoundingClientRect(); return { t: a.textContent.trim(), w: r.width, h: r.height }; }));
    check(boxes.length >= 1, `${path}@${width}: no breadcrumb links found`);
    for (const b of boxes) check(b.w >= 24 && b.h >= 24, `${path}@${width}: "${b.t}" is ${b.w.toFixed(0)}x${b.h.toFixed(0)}, needs >=24x24`);
    await ctx.close();
  }
});
finish('breadcrumb-targets');
