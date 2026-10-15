// M: the Menu/Close toggle's right edge and width do not change between closed and open (tolerance 0.5px) at 390 and
// 1024. Design-lead ruling 2026-10-15: a fixed min-width that fits "CLOSE" plus the icon, right-aligned to the gutter,
// and the edge must be identical WITH a classic (layout-taking) scrollbar too: the open panel's body overflow lock
// removes the scrollbar, which must not shift the toggle (15px today). Two browser modes: default, and classic
// scrollbars (Playwright's default --hide-scrollbars dropped, giving a 15px layout-taking scrollbar; the check fails if no scrollbar width is present).
import { chromium } from 'playwright';
import { main, openPage } from './_lib.mjs';

const TOL = 0.5;
const edge = (page) => page.evaluate(() => { const b = document.querySelector('#nh-burger').getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width }; });
const scrollbar = (page) => page.evaluate(() => innerWidth - document.documentElement.clientWidth);

await main('M menu-toggle-stable', async (r) => {
  for (const [mode, args] of [['default', []], ['classic-scrollbar', []]]) {
    const browser = await chromium.launch({ args, ignoreDefaultArgs: mode === 'classic-scrollbar' ? ['--hide-scrollbars'] : [] });
    try {
      for (const width of [390, 1024]) {
        const { ctx, page } = await openPage(browser, { width, height: 844 }, '/national-show/about');
        const tag = `${mode} @${width}`;
        if (!(await page.locator('#nh-burger').count()) || !(await page.locator('#nh-burger').isVisible())) { r.fail(`${tag}: #nh-burger missing or hidden`); await ctx.close(); continue; }
        const sb = await scrollbar(page);
        if (mode === 'classic-scrollbar' && sb <= 0) { r.fail(`${tag}: could not emulate a classic scrollbar (innerWidth - clientWidth = ${sb}); the check cannot prove the ruling`); await ctx.close(); continue; }
        const closed = await edge(page);
        await page.locator('#nh-burger').click();
        const sbOpen = await scrollbar(page);
        const open = await edge(page);
        if (Math.abs(closed.r - open.r) > TOL) r.fail(`${tag}: toggle right edge moved ${closed.r.toFixed(1)} -> ${open.r.toFixed(1)} (scrollbar ${sb}px closed, ${sbOpen}px open)`);
        if (Math.abs(closed.w - open.w) > TOL) r.fail(`${tag}: toggle width changed ${closed.w.toFixed(1)} -> ${open.w.toFixed(1)} (must be a fixed min-width fitting "CLOSE" plus the icon)`);
        await page.keyboard.press('Escape');
        const back = await edge(page);
        if (Math.abs(closed.r - back.r) > TOL) r.fail(`${tag}: toggle right edge not restored after close: ${closed.r.toFixed(1)} vs ${back.r.toFixed(1)}`);
        await ctx.close();
      }
    } finally {
      await browser.close();
    }
  }
});
