// F: menu panel at 390 (and below 1260). Opens; rest of page inert; header + lockup stay visible; Escape
// closes, focus returns to Menu, scroll position restored; accordion; closes when the viewport crosses 1260.
import { NAV } from '../../../components/chrome/nav-config.ts';
import { VP_PHONE, main, openPage, withBrowser } from './_lib.mjs';

const mega = NAV.find((n) => n.type === 'mega');
const squash = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const ORDER = ['About', 'Societies', 'Judging & Awards', 'Events', 'Members', 'National Show', 'Sponsors', 'Contact'];
const burgerOpen = (page) => page.locator('#nh-burger').getAttribute('aria-expanded');

await main('F menu-panel', async (r) => {
  await withBrowser(async (browser) => {
    const { ctx, page } = await openPage(browser, VP_PHONE, '/national-show/about');
    const burger = page.locator('#nh-burger');
    if (!(await burger.count()) || !(await burger.isVisible())) return r.fail('#nh-burger missing or not visible at 390');
    if ((await burger.getAttribute('aria-controls')) !== 'nd') r.fail('#nh-burger aria-controls must be "nd"');
    if (!/menu/i.test((await burger.textContent()) ?? '')) r.fail('Menu button label must read "Menu"');
    if (await page.locator('#nd').isVisible()) r.fail('#nd visible while closed');

    // Real use on phones: the header is not sticky, so the Menu button is clickable only while it is on screen.
    // Scroll just far enough that scrollY > 0 with Menu still visible, so Playwright does not scroll it into view.
    await page.evaluate(() => window.scrollTo(0, 60));
    const y0 = await page.evaluate(() => Math.round(scrollY));
    if (y0 < 30) return r.fail(`could not scroll to test scroll restore (scrollY=${y0})`);
    if (!(await page.evaluate(() => { const b = document.querySelector('#nh-burger').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }))) return r.fail('Menu button not fully on screen at scrollY=60');

    await burger.click();
    if ((await burgerOpen(page)) !== 'true') r.fail('click did not set aria-expanded="true" on Menu');
    if (!/close/i.test((await burger.textContent()) ?? '')) r.fail('open Menu button must read "Close"');
    if (!(await page.locator('#nd').isVisible())) r.fail('#nd not visible after open');
    if ((await page.evaluate(() => Math.round(scrollY))) !== 0) r.fail('opening must scroll to the top on phones (header is not sticky)');
    if (!(await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden' || getComputedStyle(document.documentElement).overflow === 'hidden'))) r.fail('body scroll not locked while open');
    if (!(await page.evaluate(() => !!document.activeElement?.closest('#nd')))) r.fail('focus did not move into the panel');
    const inert = await page.evaluate(() => ({
      main: !!document.querySelector('main')?.closest('[inert]'),
      footer: !!document.querySelector('#nf')?.closest('[inert]'),
      header: !!document.querySelector('#nh')?.closest('[inert]'),
      panel: !!document.querySelector('#nd')?.closest('[inert]'),
    }));
    if (!inert.main) r.fail('<main> is not inert while the panel is open');
    if (!inert.footer) r.fail('#nf is not inert while the panel is open');
    if (inert.header || inert.panel) r.fail('header or panel is inert (it must stay interactive)');
    // INK box (H:86: (54,54)-(1139,241) of 1200x294), not the img box, which the approved negative margins pull off-screen.
    const brand = await page.evaluate(() => { const b = document.querySelector('#nh .nh-brand img')?.getBoundingClientRect(); if (!b) return false; const k = b.width / 1200; return b.width > 0 && b.top + 54 * k >= 0 && b.top + 241 * k <= innerHeight && b.left + 54 * k >= 0 && b.left + 1139 * k <= innerWidth; });
    if (!brand) r.fail('header lockup ink not fully visible while the panel is open');

    const order = await page.locator('#nd .nd-list > li').evaluateAll((lis) => lis.map((li) => (li.querySelector('a,button')?.textContent ?? '').replace(/\s+/g, ' ').trim()));
    if (JSON.stringify(order) !== JSON.stringify(ORDER)) r.fail(`panel order ${JSON.stringify(order)} != ${JSON.stringify(ORDER)}`);
    if (await page.locator('#nd .nh-cta, #nd button', { hasText: /^\s*Tickets\s*$/ }).count()) r.fail('panel must not carry a second Tickets button');

    const sub = page.locator('#nd [data-sub]');
    if ((await sub.getAttribute('aria-expanded')) !== 'false') r.fail('National Show accordion must start collapsed');
    await sub.click();
    if ((await sub.getAttribute('aria-expanded')) !== 'true') r.fail('accordion did not expand');
    const text = squash(await page.locator('#nd').textContent());
    const leaves = [...mega.lead.theShow.links, ...mega.columns.flatMap((c) => c.links)];
    for (const l of leaves) {
      if (!text.includes(l.label)) r.fail(`panel leaf "${l.label}" missing`);
      if (!(await page.locator(`#nd a[href="${l.href}"]`).count())) r.fail(`panel has no link to ${l.href}`);
    }
    for (const d of mega.featureRail.destinations.filter((x) => x.variant === 'secondary')) {
      if (!(await page.locator(`#nd a[href="${d.href}"]`, { hasText: d.label }).count())) r.fail(`panel missing ${d.label} -> ${d.href}`);
    }
    if (!text.includes('Exhibitors and Vendors') || /Trade Vendors/i.test(text)) r.fail('panel must say "Exhibitors and Vendors", never "Trade Vendors"');
    if (!(await page.locator('#nd a[href="/contact"]').count())) r.fail('panel missing Contact -> /contact');

    await page.keyboard.press('Escape');
    if ((await burgerOpen(page)) !== 'false') r.fail('Escape did not collapse the Menu button');
    if (await page.locator('#nd').isVisible()) r.fail('#nd still visible after Escape');
    if (!(await page.evaluate(() => document.activeElement?.id === 'nh-burger'))) r.fail('focus did not return to Menu after Escape');
    const y1 = await page.evaluate(() => Math.round(scrollY));
    if (Math.abs(y1 - y0) > 2) r.fail(`scroll not restored: was ${y0}, now ${y1}`);
    if (await page.evaluate(() => !!document.querySelector('[inert]'))) r.fail('inert left behind after close');
    if (await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden')) r.fail('body scroll lock left behind after close');

    await burger.click();
    await page.setViewportSize({ width: 1300, height: 800 });
    await page.waitForTimeout(300);
    if (await page.locator('#nd').isVisible()) r.fail('panel must close itself when the viewport crosses 1260px');
    if (await page.evaluate(() => !!document.querySelector('[inert]'))) r.fail('inert left behind after crossing 1260px');
    await ctx.close();

    // Keyboard path (J:37, J:66): deep in the page, focus Menu without scrolling, Enter opens, Escape restores place.
    const k = await openPage(browser, VP_PHONE, '/national-show/about');
    await k.page.evaluate(() => window.scrollTo(0, 600));
    const ky0 = await k.page.evaluate(() => Math.round(scrollY));
    if (ky0 < 400) r.fail(`page too short for the keyboard scroll-restore scenario (scrollY=${ky0})`);
    await k.page.evaluate(() => document.querySelector('#nh-burger').focus({ preventScroll: true }));
    await k.page.keyboard.press('Enter');
    if ((await k.page.locator('#nh-burger').getAttribute('aria-expanded')) !== 'true') r.fail('keyboard: Enter on Menu did not open the panel');
    if ((await k.page.evaluate(() => Math.round(scrollY))) !== 0) r.fail('keyboard: opening must scroll to the top');
    await k.page.keyboard.press('Escape');
    const ky1 = await k.page.evaluate(() => Math.round(scrollY));
    if (Math.abs(ky1 - ky0) > 2) r.fail(`keyboard: scroll not restored after Escape: was ${ky0}, now ${ky1}`);
    if (!(await k.page.evaluate(() => document.activeElement?.id === 'nh-burger'))) r.fail('keyboard: focus did not return to Menu');
    await k.ctx.close();

    // Navigation while the panel is open (Codex findings): the panel must not survive a client-side navigation, the
    // destination must not be left inert / scroll-locked, and the old page's saved scroll must not leak onto it.
    const clean = async (pg, tag) => {
      await pg.waitForTimeout(500);
      if (await pg.locator('#nd').isVisible()) r.fail(`${tag}: panel still visible after navigation`);
      if (await pg.evaluate(() => !!document.querySelector('[inert]'))) r.fail(`${tag}: destination left with inert elements`);
      if (await pg.evaluate(() => getComputedStyle(document.body).overflow === 'hidden' || getComputedStyle(document.documentElement).overflow === 'hidden')) r.fail(`${tag}: body scroll still locked`);
      if ((await pg.locator('#nh-burger').getAttribute('aria-expanded')) !== 'false') r.fail(`${tag}: Menu button still aria-expanded`);
    };
    const n = await openPage(browser, VP_PHONE, '/national-show/about');
    await n.page.evaluate(() => window.scrollTo(0, 600));
    await n.page.evaluate(() => document.querySelector('#nh-burger').focus({ preventScroll: true }));
    await n.page.keyboard.press('Enter');
    await n.page.locator('#nd').waitFor({ state: 'visible' });
    await n.page.locator('#nh a.nh-cta').click();
    await n.page.waitForURL('**/national-show/tickets');
    await clean(n.page, 'CTA click while open');
    const ny = await n.page.evaluate(() => Math.round(scrollY));
    if (ny > 50) r.fail(`CTA click while open: destination scrollY is ${ny}; the old page's restoreY (600) must not be applied`);
    // history.back() from a destination reached with the panel open
    await n.page.locator('#nh-burger').click();
    await n.page.locator('#nd').waitFor({ state: 'visible' });
    await n.page.goBack();
    await n.page.waitForURL('**/national-show/about');
    await clean(n.page, 'history.back() while open');
    // and back to the page that was left with the panel open
    await n.page.goForward();
    await n.page.waitForURL('**/national-show/tickets');
    await clean(n.page, 'history.forward()');
    await n.ctx.close();
  });
});
