// F1b: in the 1280-1383 band the open Menu drawer marks the current page. On /sponsors and /contact (the two items demoted into the drawer)
// the drawer's a[href] for that route carries aria-current="page", and it is the only page-current link in the drawer.
import { withSite, openPage, check, finish } from './lib.mjs';
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1280, 1383]) {
    for (const route of ['/sponsors', '/contact']) {
      const { page, ctx } = await openPage(browser, ctxOpts, base, route, width, 900);
      const menu = page.locator('[data-hd=menu]');
      check(await menu.isVisible(), `@${width} ${route}: no visible Menu button`);
      if (await menu.isVisible()) {
        await menu.click(); await page.waitForTimeout(400);
        const dlg = page.locator('[role=dialog]');
        const link = dlg.locator(`a[href="${route}"]`).first();
        check((await link.count()) > 0 && (await link.getAttribute('aria-current')) === 'page', `@${width} ${route}: drawer a[href="${route}"] has no aria-current="page"`);
        const current = await dlg.locator('a[aria-current="page"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
        check(current.length === 1 && current[0] === route, `@${width} ${route}: drawer page-current links are [${current.join(', ')}], want only ${route}`);
      }
      await ctx.close();
    }
  }
});
finish('nav-drawer-current');
