// F1b: every destination stays reachable at 1280 and 1366. Whatever is not inline sits in the Menu drawer, and Search is
// reachable (inline or in the drawer). The 7 destinations: About, Societies, Judging & Awards, Events, National Show, Sponsors, Contact.
import { withSite, openPage, check, finish } from './lib.mjs';
const ALL = ['About', 'Societies', 'Judging & Awards', 'Events', 'National Show', 'Sponsors', 'Contact'];
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1280, 1366, 1383]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width, 900);
    const inline = await page.evaluate(() => [...document.querySelectorAll('[data-hd=nav] [data-hd=item]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim()));
    const searchInline = await page.evaluate(() => { const e = document.querySelector('[data-hd=search]'); return !!e && e.getBoundingClientRect().width > 0; });
    const menu = page.locator('[data-hd=menu]');
    const menuShown = await menu.isVisible();
    const missing = ALL.filter((l) => !inline.includes(l));
    check(inline.length === 5, `@${width}: inline nav has ${inline.length} items, want exactly 5`);
    check(missing.length === 2 && missing.includes('Sponsors') && missing.includes('Contact'), `@${width}: demoted items are [${missing.join(', ')}], want Sponsors and Contact`);
    check(!searchInline, `@${width}: Search must live in the drawer, not inline`);
    if (missing.length || !searchInline) {
      check(menuShown, `@${width}: ${missing.join(', ') || 'Search'} not inline and no visible Menu button`);
      if (menuShown) {
        await menu.click(); await page.waitForTimeout(400);
        const dlg = page.locator('[role=dialog]'); const text = (await dlg.innerText().catch(() => '')) || '';
        for (const l of missing) check(text.includes(l), `@${width}: drawer lacks "${l}"`);
        if (!searchInline) check(/search/i.test(text) || (await dlg.getByRole('button', { name: /search/i }).count()) > 0, `@${width}: Search not reachable in the drawer`);
      }
    }
    await ctx.close();
  }
});
finish('nav-reach');
