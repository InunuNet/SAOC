#!/usr/bin/env node
// F18-A2 (R75 image break vs R29 hero photos): the break is a SECOND role beside the five hero photos, with its own rule (goldens/f18/break-photo-map.json).
//  static : the golden maps four routes to four DIFFERENT stock photos, none of them the hero photo of the same route; components/nos/hero-photos.ts still equals the f3 hero map
//           (goldens/f3/hero-photo-map.json is byte-identical to F18_BASE_REF: the hero rule is not weakened)
//  runtime: on every NOS route (public build, 1280 and 390) a [data-nos-image-break] exists only on the four mapped routes, exactly once, showing exactly the mapped photo
//           (resolved through the next/image or /images/_opt loader); no photo is a break on two routes; no break shows its own route's hero photo; a route with no hero photo and
//           no break still has no stock photo anywhere (the surviving F3 imagery rule, run separately in F18-A12, keeps checking that)
// Usage: F18_BASE_REF=<sha> NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-b-imagery.mjs
import { main, openPage, withBrowser, readGolden, T, git, baseRef, readText } from './_lib.mjs';
import { assetPath, STOCK_PHOTO_RE, NOS_ROUTES } from '../../nos-own-brand-chrome/f3/_f3lib.mjs';

const MAP = readGolden('break-photo-map.json');
const breaks = MAP.breaks;

await main('F18-A2 image breaks', async (r) => {
  // static
  const photos = Object.values(breaks);
  if (new Set(photos).size !== photos.length) r.fail('break-photo-map.json uses one photo as a break on two routes');
  for (const [route, src] of Object.entries(breaks)) {
    if (!STOCK_PHOTO_RE.test(src)) r.fail(`break-photo-map.json: ${route} -> ${src} is not one of the five rights-cleared photos`);
    if (MAP.heroRoutes[route] === src) r.fail(`break-photo-map.json: ${route} repeats its own hero photo ${src}`);
  }
  const heroSrc = readText('components/nos/hero-photos.ts') ?? '';
  for (const [route, src] of Object.entries(MAP.heroRoutes)) if (!heroSrc.includes(`'${route}': { src: '${src}'`)) r.fail(`components/nos/hero-photos.ts no longer maps ${route} to ${src}`);
  const f3 = '.agent/memory/project/specs/nos-own-brand-chrome/goldens/f3/hero-photo-map.json';
  if (git('diff', '--stat', baseRef(), '--', f3).trim()) r.fail(`${f3} changed: the hero-photo rule is not F18's to edit`);
  // runtime
  const seen = new Map();
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const [name, [w, h]] of [['1280', T.viewports.desktop], ['390', T.viewports.phone]]) {
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        const tag = `${route} @${name}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        await page.evaluate(() => { document.querySelectorAll('img[loading="lazy"]').forEach((i) => i.scrollIntoView()); window.scrollTo(0, 0); });
        const m = await page.evaluate(() => ({
          breaks: [...document.querySelectorAll('[data-nos-image-break] img')].map((i) => i.currentSrc || i.getAttribute('src') || ''),
          hero: [...document.querySelectorAll('[data-nos-hero] img')].map((i) => i.currentSrc || i.getAttribute('src') || ''),
        }));
        const got = m.breaks.map(assetPath);
        const want = breaks[route];
        if (want) {
          if (got.length !== 1) r.fail(`${tag}: ${got.length} image break photo(s), want exactly 1`);
          else if (got[0] !== want) r.fail(`${tag}: image break shows ${got[0]}, want ${want}`);
        } else if (got.length) r.fail(`${tag}: an image break renders on a route the map does not list (${got.join(', ')})`);
        if (name === '1280') for (const p of got) seen.set(p, [...(seen.get(p) ?? []), route]);
        for (const p of got) if (m.hero.map(assetPath).includes(p)) r.fail(`${tag}: the break repeats this route's own hero photo ${p}`);
        await ctx.close();
      }
    }
  });
  for (const [p, routes] of seen) if (routes.length > 1) r.fail(`${p} is a break on ${routes.length} routes (${routes.join(', ')}); at most once`);
});
