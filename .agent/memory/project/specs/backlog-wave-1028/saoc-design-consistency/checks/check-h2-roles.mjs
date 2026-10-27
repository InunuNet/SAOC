// F1c (SA-6): every <h2> in <main> is exactly one of two roles. H2 role: serif 300, clamp(32px, 29px + 0.762vw, 44px),
// line-height 1.15. Title role (card-type h2): serif 400, 20-22px. Anything else fails. Checked at 390, 1440 and 2056.
import { withSite, openPage, check, finish } from './lib.mjs';
const ROUTES = ['/about', '/judging', '/sponsors', '/members', '/memorandum-of-incorporation', '/privacy', '/terms', '/refunds', '/societies', '/contact'];
const clamp = (vw) => Math.min(44, Math.max(32, 29 + 0.00762 * vw));
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  // Home and the Events list need live Sanity events, so they are probed only on a deployed origin.
  const routes = deployed ? ['/', ...ROUTES, '/events'] : ROUTES;
  for (const width of [390, 1440, 2056]) for (const path of routes) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width);
    check(status === 200, `${path}@${width} status ${status}`);
    const hs = await page.evaluate(() => [...document.querySelectorAll('main h2')].filter((h) => !h.closest('[data-page-hero]') && !h.closest('[data-home-hero-media]')).map((h) => { const c = getComputedStyle(h); return { t: h.textContent.trim().slice(0, 30), size: parseFloat(c.fontSize), wt: Number(c.fontWeight), lh: parseFloat(c.lineHeight) / parseFloat(c.fontSize), fam: c.fontFamily.split(',')[0].toLowerCase() }; }));
    for (const h of hs) {
      const serif = /crimson|serif/.test(h.fam);
      const asH2 = serif && h.wt === 300 && Math.abs(h.size - clamp(width)) <= 0.6 && Math.abs(h.lh - 1.15) <= 0.01;
      const asTitle = serif && h.wt === 400 && h.size >= 20 && h.size <= 22;
      check(asH2 || asTitle, `${path}@${width}: h2 "${h.t}" is ${h.size.toFixed(1)}px/${h.wt}/lh ${h.lh.toFixed(2)} (${h.fam}); want H2 role ${clamp(width).toFixed(1)}px/300/1.15 or Title role 20-22px/400`);
    }
    await ctx.close();
  }
});
finish('h2-roles');
