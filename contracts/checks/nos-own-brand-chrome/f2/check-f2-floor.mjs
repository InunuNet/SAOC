// F2-T2: no visible text under 12px on any NOS page (the type floor: mapping "Floor: 12px everywhere"; HANDOFF
// "Type floor"). Visually hidden labels (<=2px boxes) are exempt. All 17 routes at 1280, 390 and 375.
import { NOS_ROUTES, main, openPage, withBrowser, snapshotText, describe } from './_f2lib.mjs';

const VPS = [['1280', { width: 1280, height: 800 }], ['390', { width: 390, height: 844 }], ['375', { width: 375, height: 812 }]];

await main('F2-T2 type-floor', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const [name, vp] of VPS) {
        const { ctx, page } = await openPage(browser, vp, route);
        const texts = await page.evaluate(snapshotText);
        const small = texts.filter((t) => t.size < 12 - 0.01);
        if (small.length) r.fail(`${route} @${name}: ${small.length} text element(s) under 12px, e.g. ${small.slice(0, 4).map((t) => `${describe(t)} ${t.size}px`).join(' | ')}`);
        await ctx.close();
      }
    }
  });
});
