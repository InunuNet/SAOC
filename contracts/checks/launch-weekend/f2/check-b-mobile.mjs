#!/usr/bin/env node
// A2 — SAOC chrome at 390: the header action zone carries no Contact link, the mobile menu lists Contact and the
// Tickets destination (reachable by click, expanding the National Show item if it is collapsed), both navigate,
// and the open menu does not overflow horizontally. Pages: /, /societies, /about, /contact.
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f2/check-b-mobile.mjs
import { BASE, PAGES, TICKETS_HREF, launch, newPage, open, report } from './_lib.mjs';

const problems = [];
const bad = (w, m) => problems.push(`${w}: ${m}`);
const vp = { width: 390, height: 844, isMobile: true };
const browser = await launch();

const openMenu = async (page) => { await page.getByRole('button', { name: /open menu/i }).click(); await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 }); };
const linkIn = (page, href) => page.getByRole('dialog').locator(`a[href="${href}"]`).filter({ visible: true }).first();

for (const route of PAGES) {
  for (const target of ['/contact', TICKETS_HREF]) {
    const where = `390px ${route} -> ${target}`;
    const { ctx, page } = await newPage(browser, vp);
    await open(page, route);
    const stray = await page.evaluate(() => [...document.querySelectorAll('header a[href="/contact"]')].filter((a) => !a.closest('nav,[role="dialog"]') && a.checkVisibility({ checkVisibilityCSS: true })).length);
    if (stray) bad(where, 'a Contact link is visible in the header outside the menu');
    await openMenu(page);
    let link = linkIn(page, target);
    if (!(await link.count())) {
      const group = page.getByRole('dialog').getByRole('button', { name: /national show/i }).first();
      if (await group.count()) { await group.click(); link = linkIn(page, target); }
    }
    if (!(await link.count())) { bad(where, `no visible ${target} link in the mobile menu`); await ctx.close(); continue; }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) bad(where, `menu open: horizontal overflow ${overflow}px`);
    if (target === '/contact' && (await link.textContent()).trim() !== 'Contact') bad(where, 'menu link label is not "Contact"');
    if (target === TICKETS_HREF && !/^Tickets/.test((await link.textContent()).trim())) bad(where, `menu Tickets link label is "${(await link.textContent()).trim()}"`);
    await Promise.all([page.waitForURL('**' + target, { timeout: 15000 }).catch(() => null), link.click()]);
    if (new URL(page.url()).pathname !== target) bad(where, `click landed on ${new URL(page.url()).pathname}`);
    await ctx.close();
  }
}
await browser.close();
report(problems, `Contact and Tickets reachable from the 390px menu on ${PAGES.length} pages at ${BASE}`);
