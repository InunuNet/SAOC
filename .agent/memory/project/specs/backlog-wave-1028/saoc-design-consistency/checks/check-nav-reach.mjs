// F1b: every destination stays reachable at 1280 and 1366. Whatever is not inline sits in the Menu drawer, and Search is
// reachable (inline or in the drawer). The 7 destinations: About, Societies, Judging & Awards, Events, National Show, Sponsors, Contact.
// Each inline item must be a real destination, not just visible text: an <a> with a non-empty, non-# href that resolves (same-origin: responds 200; a cross-origin href such as the NOS Show site is
// fetched only on a deployed run, locally it must still parse as an absolute http(s) URL), visible, neither aria-hidden nor inert (itself or any ancestor), and clickable: computed pointer-events is not none and elementFromPoint at its centre is the link or one of its descendants (no overlay, no pointer-events:none).
import { withSite, openPage, check, finish } from './lib.mjs';
// Every visible link and control in the open drawer must be clickable: computed pointer-events is not none and elementFromPoint at its centre (scrolled into view) is the element or a descendant.
const DRAWER = `() => [...document.querySelectorAll('[role=dialog] a[href], [role=dialog] button, [role=dialog] input')].filter((e) => e.checkVisibility({ checkVisibilityCSS: true })).map((e) => { e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { name: (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30), tag: e.tagName, pe: getComputedStyle(e).pointerEvents, hit: Boolean(t) && (t === e || e.contains(t)) }; })`;
async function checkDrawer(page, w) {
  const items = await page.evaluate(`(${DRAWER})()`);
  check(items.filter((i) => i.tag === 'A').length >= 2, `${w}: the open drawer has ${items.filter((i) => i.tag === 'A').length} visible links, want at least 2`);
  for (const i of items) { check(i.pe !== 'none', `${w}: drawer ${i.tag.toLowerCase()} "${i.name}" has pointer-events: none`); check(i.hit, `${w}: drawer ${i.tag.toLowerCase()} "${i.name}" is covered or unclickable (elementFromPoint at its centre is something else)`); }
  return items;
}
const ALL = ['About', 'Societies', 'Judging & Awards', 'Events', 'National Show', 'Sponsors', 'Contact'];
await withSite(async ({ base, browser, ctxOpts, live }) => {
  for (const width of [1280, 1366, 1383]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width, 900);
    const items = await page.evaluate(() => [...document.querySelectorAll('[data-hd=nav] [data-hd=item]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ label: e.textContent.trim(), tag: e.tagName, href: e.getAttribute('href'),
      visible: e.checkVisibility({ checkVisibilityCSS: true }), hidden: Boolean(e.closest('[aria-hidden=true],[inert]')), pe: getComputedStyle(e).pointerEvents,
      hit: (() => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(t) && (t === e || e.contains(t)); })() })));
    const inline = items.map((i) => i.label);
    for (const it of items) {
      const w = `@${width}: inline nav item "${it.label}"`;
      check(it.tag === 'A', `${w} is a <${it.tag.toLowerCase()}>, want an <a>`);
      check(it.visible && !it.hidden, `${w} is not visible and actionable (visible ${it.visible}, aria-hidden/inert ancestor ${it.hidden})`);
      check(it.pe !== 'none', `${w} has pointer-events: none`);
      check(it.hit, `${w}: elementFromPoint at its centre is not the link or a descendant (covered or unclickable)`);
      let url = null; try { url = it.href && !/^(#|javascript:)/i.test(it.href.trim()) ? new URL(it.href, base) : null; } catch { url = null; }
      check(url !== null && /^https?:$/.test(url.protocol), `${w} has no resolvable href (${JSON.stringify(it.href)})`);
      if (url && (url.origin === new URL(base).origin || live)) { const res = await ctx.request.get(url.href); check(res.status() === 200, `${w} href ${it.href} responds ${res.status()}, want 200`); }
    }
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
        const dlg = page.locator('[role=dialog]');
        await checkDrawer(page, `@${width}`);
        // Real anchors, not text: Sponsors and Contact must be a[href] links in the open drawer, visible and enabled.
        for (const href of ['/sponsors', '/contact']) {
          const a = dlg.locator(`a[href="${href}"]`).first();
          check((await a.count()) > 0 && (await a.isVisible()), `@${width}: drawer has no visible a[href="${href}"]`);
        }
        // Search: a button or input with an accessible name inside the drawer, visible and enabled.
        const search = dlg.getByRole('button', { name: /search/i }).or(dlg.getByRole('searchbox')).or(dlg.getByRole('textbox', { name: /search/i }));
        check((await search.count()) > 0 && (await search.first().isVisible()) && (await search.first().isEnabled()), `@${width}: no usable Search control (named button or input) in the drawer`);
      }
    }
    await ctx.close();
  }
  // 390: the Menu opens the whole nav; every destination and Search is reachable and clickable in the drawer.
  for (const width of [390]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width, 800); const w = `@${width}`;
    const menu = page.locator('[data-hd=menu]'); check(await menu.isVisible(), `${w}: no visible Menu button`);
    if (await menu.isVisible()) {
      await menu.click(); await page.waitForTimeout(400);
      const items = await checkDrawer(page, w);
      for (const label of ALL) check(items.some((i) => i.tag === 'A' && i.name.includes(label)), `${w}: drawer has no clickable link "${label}"`);
      check(items.some((i) => /search/i.test(i.name)), `${w}: drawer has no clickable Search control`);
    }
    await ctx.close();
  }
});
finish('nav-reach');
