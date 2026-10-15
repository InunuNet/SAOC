// F2-H3: the brightest composited pixel behind every hero text run keeps contrast >= 4.5:1 against that text's colour.
// Method: hide all hero text (colour transparent), screenshot each text run's box from the real composite (photo + scrim +
// mask), take the brightest AND darkest pixel inside it, composite the text colour (alpha) over each, WCAG-contrast, keep
// the worst. CTA labels are skipped (they sit on their own fill). Hub and inner heroes; widths 1280/768/390/375.
import { NOS_ROUTES, main, openPage, withBrowser, heroInfo, extremes, contrast, parseColor } from './_f2lib.mjs';

const MIN = Number(process.env.NOS_F2_CONTRAST_MIN || 4.5);
const VPS = [[1280, 800], [1024, 768], [768, 1024], [390, 844], [375, 812]];

await main('F2-H3 hero-contrast', async (r) => {
  await withBrowser(async (browser) => {
    const only = process.env.NOS_ROUTE_FILTER ? new RegExp(process.env.NOS_ROUTE_FILTER) : null; // F3: restrict to the photo-hero routes the F3 map adds
    for (const route of NOS_ROUTES.filter((x) => !only || only.test(x))) {
      const { ctx, page } = await openPage(browser, { width: 1280, height: 800 }, route);
      await page.addStyleTag({ content: '[data-nos-hero], [data-nos-hero] * { transition: none !important; animation: none !important; }' });
      for (const [w, vh] of VPS) {
        await page.setViewportSize({ width: w, height: vh });
        await page.waitForTimeout(250);
        const tag = `${route} @${w}`;
        const h = await page.evaluate(heroInfo);
        if (!h) { r.fail(`${tag}: no [data-nos-hero]`); continue; }
        const style = await page.addStyleTag({ content: '[data-nos-hero] *, [data-nos-hero] { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }' });
        await page.waitForTimeout(80);
        const runs = h.texts.filter((t) => t.text);
        let worst = Infinity;
        let worstRun = null;
        for (const t of runs) {
          const fg = parseColor(t.color);
          if (!fg) continue;
          const clip = { x: Math.max(0, t.x), y: Math.max(0, t.y), width: Math.max(2, Math.min(t.w, w - t.x)), height: Math.max(2, t.h) };
          const png = await page.screenshot({ fullPage: true, clip, type: 'png' });
          const { hi, lo } = await extremes(page, png);
          for (const bg of [hi, lo]) {
            const eff = fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));
            const cr = contrast(eff, bg);
            if (cr < worst) { worst = cr; worstRun = `"${t.text}" fg ${t.color} over rgb(${bg})`; }
          }
        }
        await style.evaluate((el) => el.remove());
        if (worst < MIN) r.fail(`${tag}: worst contrast ${worst.toFixed(2)}:1 < ${MIN}:1 at ${worstRun}`);
        else r.note(`${tag}: worst ${worst === Infinity ? 'n/a' : worst.toFixed(2)}:1`);
      }
      await ctx.close();
    }
  });
});
