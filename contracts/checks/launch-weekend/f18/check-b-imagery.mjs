#!/usr/bin/env node
// F18-A2 (R16 one photo per route; supersedes the F18 image-break role after design-cb's audit): the long-form image break is RETIRED.
//  static : goldens/f18/break-photo-map.json lists no break; components/nos/hero-photos.ts still equals the f3 hero map and goldens/f3/hero-photo-map.json is byte-identical to
//           F18_BASE_REF (the hero rule is not weakened); components/nos/long-form-breaks.ts does not exist
//  runtime: on every NOS route (public build, 1280 and 390) there is no [data-nos-image-break] and no .nos-image-break element; a route with no hero photo has no stock photo
//           anywhere outside [data-ticket-stub] (the surviving F3 imagery rule, run separately in F18-A12, keeps checking that)
// Usage: F18_BASE_REF=<sha> NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-b-imagery.mjs
import { main, openPage, withBrowser, readGolden, T, git, baseRef, readText } from './_lib.mjs';
import { NOS_ROUTES } from '../../nos-own-brand-chrome/f3/_f3lib.mjs';

const MAP = readGolden('break-photo-map.json');

await main('F18-A2 no image breaks', async (r) => {
  // static
  if (Object.keys(MAP.breaks).length) r.fail('break-photo-map.json still lists image breaks (the role is retired, R16 one photo per route)');
  const heroSrc = readText('components/nos/hero-photos.ts') ?? '';
  for (const [route, src] of Object.entries(MAP.heroRoutes)) if (!heroSrc.includes(`'${route}': { src: '${src}'`)) r.fail(`components/nos/hero-photos.ts no longer maps ${route} to ${src}`);
  if (readText('components/nos/long-form-breaks.ts') !== null) r.fail('components/nos/long-form-breaks.ts still exists (the break role is retired)');
  const f3 = '.agent/memory/project/specs/nos-own-brand-chrome/goldens/f3/hero-photo-map.json';
  if (git('diff', '--stat', baseRef(), '--', f3).trim()) r.fail(`${f3} changed: the hero-photo rule is not F18's to edit`);
  // runtime
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const [name, [w, h]] of [['1280', T.viewports.desktop], ['390', T.viewports.phone]]) {
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        const tag = `${route} @${name}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        const n = await page.evaluate(() => document.querySelectorAll('[data-nos-image-break], .nos-image-break').length);
        if (n) r.fail(`${tag}: ${n} image break element(s), want exactly 0 (R16 one photo per route)`);
        await ctx.close();
      }
    }
  });
});
