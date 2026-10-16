// F3-M (NOS Site critique items 4 and 5, Acceptance bar E4): on every NOS route at 1280 and 390,
//  - every in-flow <img> in <main> has explicit width and height attributes (or an aspect-ratio on itself or a parent within two levels); a position:absolute
//    `fill` image is sized by its container and covered by the CLS limit;
//  - every <source> inside a <picture> has a non-empty srcset (a <source media> with no srcset is silently ignored: beta shipped one);
//  - cumulative layout shift over load plus a full scroll is below 0.05.
import { allRoutes, main, withBrowser, BASE } from './_f3lib.mjs';

const VPS = [['1280', { width: 1280, height: 800 }], ['390', { width: 390, height: 844 }]];
const CLS_MAX = 0.05;

function measure() {
  const noDims = [];
  for (const img of document.querySelectorAll('main img')) {
    if (img.closest('#nh, #nd, #nf')) continue;
    if (getComputedStyle(img).position === 'absolute') continue; // next/image `fill`: sized by its positioned container (hero media); CLS below judges it
    const hasAttrs = img.hasAttribute('width') && img.hasAttribute('height');
    let ratio = false;
    for (let e = img, i = 0; e && i < 3; e = e.parentElement, i++) if (getComputedStyle(e).aspectRatio !== 'auto') ratio = true;
    if (!hasAttrs && !ratio) noDims.push(`${(img.getAttribute('src') ?? '').slice(0, 60)}`);
  }
  const noSrcset = [...document.querySelectorAll('picture > source')].filter((s) => !(s.getAttribute('srcset') ?? '').trim()).map((s) => `source media="${s.getAttribute('media')}"`);
  return { noDims, noSrcset };
}

await main('F3-M media', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of await allRoutes(browser)) {
      for (const [name, vp] of VPS) {
        const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
        await ctx.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
        const page = await ctx.newPage();
        const res = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
        const tag = `${route} @${name}`;
        if (!res || res.status() !== 200) { r.fail(`${tag}: HTTP ${res?.status()}`); await ctx.close(); continue; }
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < h; y += vp.height / 2) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
        await page.waitForTimeout(300);
        const m = await page.evaluate(measure);
        const cls = await page.evaluate(() => window.__cls);
        for (const s of m.noDims) r.fail(`${tag}: <img src="${s}"> has no width/height and no aspect-ratio`);
        for (const s of m.noSrcset) r.fail(`${tag}: ${s} has no srcset (silently ignored)`);
        if (cls >= CLS_MAX) r.fail(`${tag}: CLS ${cls.toFixed(3)} >= ${CLS_MAX}`);
        await ctx.close();
      }
    }
  });
});
