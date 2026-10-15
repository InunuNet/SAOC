// J: Tickets CTA is /national-show/tickets and carries aria-current="page" on that page only; the National
// Show trigger carries data-current on every NOS page; the current page's mega leaf has aria-current.
import { NOS_ROUTES, VP_DESKTOP, main, openPage, withBrowser } from './_lib.mjs';

await main('J aria-current', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      const { ctx, page } = await openPage(browser, VP_DESKTOP, route);
      const cta = page.locator('#nh .nh-cta');
      if ((await cta.count()) !== 1) { r.fail(`${route}: want exactly one #nh .nh-cta, found ${await cta.count()}`); await ctx.close(); continue; }
      if ((await cta.getAttribute('href')) !== '/national-show/tickets') r.fail(`${route}: CTA href is ${await cta.getAttribute('href')}`);
      if (((await cta.textContent()) ?? '').trim().toLowerCase() !== 'tickets') r.fail(`${route}: CTA label is not "Tickets"`);
      const cur = await cta.getAttribute('aria-current');
      if (route === '/national-show/tickets' && cur !== 'page') r.fail(`${route}: CTA aria-current is ${cur}, want "page"`);
      if (route !== '/national-show/tickets' && cur) r.fail(`${route}: CTA has aria-current="${cur}" off the tickets page`);
      if (!(await page.locator('#nh-show-trigger').count())) { r.fail(`${route}: #nh-show-trigger missing`); await ctx.close(); continue; }
      if ((await page.locator('#nh-show-trigger').getAttribute('data-current')) === null) r.fail(`${route}: National Show trigger lacks data-current`);
      if (route !== '/national-show' && route !== '/national-show/tickets') {
        await page.locator('#nh-show-trigger').click();
        const n = await page.locator(`#nh-mega a[href="${route}"][aria-current="page"]`).count();
        if (n < 1) r.fail(`${route}: no mega leaf with aria-current="page" for this route`);
      }
      await ctx.close();
    }
    // Elevation: sticky + .is-scrolled at 1280, not sticky at 390 (HANDOFF Header > Bar).
    const d = await openPage(browser, VP_DESKTOP, '/national-show/about');
    if (!(await d.page.locator('#nh').count())) { r.fail('#nh missing'); return; }
    if ((await d.page.evaluate(() => getComputedStyle(document.querySelector('#nh')).position)) !== 'sticky') r.fail('header must be position:sticky at 1280');
    await d.page.evaluate(() => window.scrollTo(0, 400));
    await d.page.waitForTimeout(300);
    if (!(await d.page.evaluate(() => document.querySelector('#nh').classList.contains('is-scrolled')))) r.fail('header lacks .is-scrolled once the page scrolls');
    await d.ctx.close();
    const p = await openPage(browser, { width: 390, height: 844 }, '/national-show/about');
    if ((await p.page.evaluate(() => getComputedStyle(document.querySelector('#nh')).position)) !== 'relative') r.fail('header must be position:relative (not sticky) at 390');
    await p.ctx.close();
  });
});
