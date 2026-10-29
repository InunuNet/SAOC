// f2 wrapper of the f1 scrim-alpha gate (gate-scrim-alpha.mjs stays frozen, untouched). The assertion is unchanged: alpha over the bloom region
// <= .1 at 1440@2, 2056@2, 390@3 with the f1 44% zone (f1 thresholds, NOT the f2 34% override). Only the route set differs: the photographic
// routes come from the f2-merged heroRoutes (goldens/f2.json typographicNow applied through f2-lib.mjs), the source the other f2 gates use, so
// /404, /events/submit and /societies/[slug] (typographic from f2 on) are skipped instead of waiting 20 s for an <img> that is not there.
// Cites docs/rules/no-invention.md: no new threshold, no new assertion.
// HM-2 scrim alpha gate (NOS Design 2026-10-26): the scrim's alpha over the bloom region is at most 0.1 on every photograph hero.
// Method: the hero is painted twice with the text hidden, once as rendered and once as the photograph alone; per pixel and channel
// alpha = (photo - rendered) / (photo - sage) with sage rgb(34 40 31), taken only where |photo - sage| > 40 (below that the alpha is not
// recoverable), averaged over the bloom region. Bloom region: the left 0-44% from 768 up (T.bloomCleanZoneEnd); the whole photograph band
// below 768. Viewports 1440@2, 2056@2, 390@3 (the 10-26 HM-3 viewports). Typographic routes have no photograph and are skipped.
import { T } from './_lib.mjs';
import { GOLDEN, freeze, heroBackgroundShot, heroPhotoOnlyShot, launchChromium, newContext, openHeroRoute, pixelPage, withServer } from './f2-lib.mjs';

const ALPHA_MAX = 0.1;
const MIN_SPREAD = 40;
const VPS = [{ name: '1440@2', width: 1440, height: 900, dsf: 2 }, { name: '2056@2', width: 2056, height: 1200, dsf: 2 }, { name: '390@3', width: 390, height: 844, dsf: 3 }];
const HERO = 'section[data-page-hero]';

async function meanAlpha(px, normalB64, photoB64, region, sage) {
  return px.evaluate(async ({ a, b, rg, s, spread }) => {
    const load = (v) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${v}`; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const x0 = Math.round(rg.x0 * w), x1 = Math.round(rg.x1 * w), y0 = Math.round(rg.y0 * h), y1 = Math.round(rg.y1 * h);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(ia, 0, 0); const dn = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    ctx.clearRect(0, 0, w, h); ctx.drawImage(ib, 0, 0); const dp = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let sum = 0, n = 0;
    for (let i = 0; i < dn.length; i += 4) for (let k = 0; k < 3; k += 1) {
      const gap = dp[i + k] - s[k];
      if (Math.abs(gap) > spread) { sum += (dp[i + k] - dn[i + k]) / gap; n += 1; }
    }
    return n ? sum / n : 0;
  }, { a: normalB64, b: photoB64, rg: region, s: sage, spread: MIN_SPREAD });
}

await withServer(5, 'scrim alpha f2 route set (saoc)', async (server, c) => {
  const browser = await launchChromium();
  const px = await pixelPage(browser);
  try {
    for (const vp of VPS) {
      const context = await newContext(browser, vp);
      const page = await context.newPage();
      for (const route of GOLDEN.heroRoutes.filter((r) => r.variant !== 'type')) {
        const tag = `[saoc ${vp.name} ${route.path}]`;
        const path = await openHeroRoute(page, server, route, c, tag);
        if (!path) continue;
        await freeze(page);
        // A 4k photo that has not painted reads as sage (alpha ~1): wait for load, decode and two frames, as the geometry gate does.
        await page.waitForFunction((s) => { const i = document.querySelector(s); return i && i.complete && i.naturalWidth > 0; }, `${HERO} img`, { timeout: 20000 });
        await page.evaluate(async (s) => { await document.querySelector(s).decode(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, `${HERO} img`);
        const stacked = vp.width < T.stackedBelow;
        const geo = await page.evaluate((h) => {
          const hero = document.querySelector(h).getBoundingClientRect(); const img = document.querySelector(`${h} img`).getBoundingClientRect();
          return { heroH: hero.height, imgH: img.height };
        }, HERO);
        const region = stacked ? { x0: 0, x1: 1, y0: 0, y1: Math.min(1, geo.imgH / geo.heroH) } : { x0: 0, x1: T.bloomCleanZoneEnd, y0: 0, y1: 1 };
        const normal = await heroBackgroundShot(page, HERO);
        const photo = await heroPhotoOnlyShot(page, HERO, 'img');
        const alpha = await meanAlpha(px, normal.b64, photo.b64, region, T.solidGroundRgb);
        c.check(`${tag} scrim alpha over the bloom region ${alpha.toFixed(3)} <= ${ALPHA_MAX}`, alpha <= ALPHA_MAX);
      }
      await context.close();
    }
  } finally { await px.close(); await browser.close(); }
});
