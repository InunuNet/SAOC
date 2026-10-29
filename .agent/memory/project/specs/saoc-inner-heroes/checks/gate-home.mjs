// Home carousel gate. HS-2: every slide img has alt="" (the slide group keeps its aria-label). HS-1 final picks: the two slides are
// orchid-dark then orchid-purple (violet retired). Layout: stacked (2/1 photo band first, copy on a solid sage panel) at <= 1023, the
// localised scrim at >= 1280, and at 1024-1279 either all stacked (breakpoint 1279) or all unstacked (breakpoint 1023): never mixed.
// The gate reports which one the build is in; the per-glyph contrast gate (gate-contrast.mjs home) decides whether the unstacked
// 1024-1279 band is allowed to stay unstacked (if the dark slide fails there, the stack must extend to 1279).
import { GOLDEN, T, docRect, freeze, launchChromium, meanAbsDiff, meanColor, newContext, pixelPage, heroBackgroundShot, heroPhotoOnlyShot, withServer } from './_lib.mjs';

const HERO = 'section[data-home-hero]';
const solid = (rgb) => rgb.every((v, i) => Math.abs(v - T.solidGroundRgb[i]) <= T.solidGroundTolerance);
const VPS = [390, 767, 1023, 1024, 1152, 1279, 1280, 1440, 2056];

await withServer(6, 'home carousel (HS-1, HS-2)', async (server, c) => {
  const browser = await launchChromium();
  const px = await pixelPage(browser);
  try {
    const state = {};
    for (const width of VPS) {
      const context = await newContext(browser, { width, height: 900, dsf: 1 });
      const page = await context.newPage();
      const res = await page.goto(`${server.saoc}/`, { waitUntil: 'load' });
      c.check(`[${width}] home responds 200`, res?.status() === 200, String(res?.status()));
      const slides = await page.evaluate(() => [...document.querySelectorAll('[data-hero-slide]')].map((s) => ({
        key: s.getAttribute('data-hero-slide'), label: s.getAttribute('aria-label'),
        imgs: [...s.querySelectorAll('img')].map((i) => ({ alt: i.getAttribute('alt'), role: i.getAttribute('role') })),
      })));
      const want = GOLDEN.home.slides.map((s) => s.key);
      c.check(`[${width}] the carousel renders the ruled slides in order (${want.join(', ')})`, JSON.stringify(slides.map((s) => s.key)) === JSON.stringify(want), JSON.stringify(slides.map((s) => s.key)));
      if (width === 1440) for (const s of slides) {
        c.check(`slide ${s.key} has exactly one img`, s.imgs.length === 1);
        c.check(`slide ${s.key} img alt is the empty string (HS-2)`, s.imgs.every((i) => i.alt === ''), JSON.stringify(s.imgs));
        c.check(`slide ${s.key} group keeps an aria-label`, Boolean(s.label));
      }
      await freeze(page);
      await page.evaluate(() => document.fonts.ready);
      const geo = await page.evaluate(() => {
        const rects = [...document.querySelectorAll('[data-hero-slide]')].map((s) => s.getBoundingClientRect());
        const photoBottom = Math.max(...rects.map((r) => r.bottom + scrollY));
        const photoWidth = rects[0].width;
        const eyebrow = document.querySelector('[data-home-hero] span.rounded-full');
        const h1 = document.querySelector('[data-home-hero] h1');
        const copyTop = Math.min(...[eyebrow, h1].filter(Boolean).map((e) => e.getBoundingClientRect().top + scrollY));
        return { photoBottom, photoWidth, copyTop };
      });
      const hero = await docRect(page, HERO);
      const isStacked = geo.copyTop >= geo.photoBottom - 1;
      state[width] = isStacked;
      if (isStacked) {
        const bandH = geo.photoBottom - hero.y;
        c.check(`[${width}] stacked: band height ${Math.round(bandH)} = width / ${T.bandAspect} +-${T.bandAspectTolerancePx}px`, Math.abs(bandH - geo.photoWidth / T.bandAspect) <= T.bandAspectTolerancePx);
        const normal = await heroBackgroundShot(page, HERO);
        const photo = await heroPhotoOnlyShot(page, HERO, '[data-hero-slide] img');
        const diff = await meanAbsDiff(px, normal.b64, photo.b64, { x0: 0, x1: 1, y0: 0, y1: bandH / hero.h });
        c.check(`[${width}] stacked: nothing but the photograph over the band (mean abs diff ${diff.toFixed(2)})`, diff <= T.cleanZoneMeanAbsDiffMax);
        const rgb = await meanColor(px, normal.b64, { x: 4, y: Math.round(bandH + 6), w: 8, h: 8 });
        c.check(`[${width}] stacked: the copy panel is solid sage rgb(${T.solidGroundRgb}) (measured ${rgb.map(Math.round)})`, solid(rgb));
      }
      await context.close();
    }
    for (const w of [390, 767, 1023]) c.check(`home is stacked at ${w}`, state[w] === true);
    for (const w of [1280, 1440, 2056]) c.check(`home is not stacked at ${w}`, state[w] === false);
    const mid = [1024, 1152, 1279].map((w) => state[w]);
    c.check(`1024-1279 is not mixed (stacked: ${mid.join(', ')})`, mid.every((v) => v === mid[0]));
    c.note(`STACK BREAKPOINT: home stacks at <= ${mid.every(Boolean) ? 1279 : 1023} (1024/1152/1279 stacked: ${mid.join('/')})`);
  } finally { await px.close(); await browser.close(); }
});
