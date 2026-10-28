// F1e lever 2: CLS < 0.02 across the font swap. Font responses are delayed 1500 ms so the swap lands well after first paint (the worst case the metric-matched
// fallback must absorb); layout-shift entries without recent input are summed over load + 3 s. Run on a PRODUCTION build (DC_PROD=1) at 390 and 1440 on /about (and / when it renders).
import { withSite, check, finish } from './lib.mjs';
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  for (const width of [390, 1440]) for (const path of deployed ? ['/', '/about'] : ['/about']) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 })); const page = await ctx.newPage();
    await page.route(/\.woff2(\?|$)/, async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto(base + path, { waitUntil: 'load', timeout: 120000 }); await page.waitForTimeout(3500);
    const cls = await page.evaluate(() => window.__cls); console.log(`${path}@${width} CLS ${cls.toFixed(4)}`);
    check(cls < 0.02, `${path}@${width}: CLS ${cls.toFixed(4)} across the font swap, want < 0.02`); await ctx.close();
  }
});
finish('cls-font-swap');
