#!/usr/bin/env node
// A1 — SAOC header at 1280 (inline nav) and 1000 (hamburger mode), on /, /societies, /about, /contact.
//  - One action-zone CTA: link text "Tickets", href /national-show/tickets, in Contact's old slot (right edge and
//    vertical box within 1px of the golden) with Contact's exact button style; exactly one such filled link in the header.
//  - Its label and href equal the Tickets leaf in the National Show mega (the nav-config source), opened live.
//  - No Contact button in the action zone; Contact is a plain link in nav[aria-label=Primary], last item (1280 only).
//  - Primary nav items do not wrap. Keyboard: Contact then the CTA are Tab-reachable, in that order; Enter on the CTA
//    lands on /national-show/tickets.
//  - Utility-bar show pill is still present and its href differs from the CTA's (a duplicate destination would void R26's keep-the-pill case).
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f2/check-a-desktop.mjs
import { BASE, PAGES, TICKETS_HREF, CTA_STYLE_PROPS, launch, newPage, open, loadGolden, actionLinkInPage, report } from './_lib.mjs';

const golden = loadGolden();
const problems = [];
const browser = await launch();
const bad = (w, m) => problems.push(`${w}: ${m}`);

for (const width of [1280, 1000]) {
  for (const route of PAGES) {
    const where = `${width}px ${route}`;
    const { ctx, page } = await newPage(browser, { width, height: 900, isMobile: false });
    await open(page, route);
    const cta = await page.evaluate(`(${actionLinkInPage})('${TICKETS_HREF}', ${JSON.stringify(CTA_STYLE_PROPS)})`);
    const base = golden.contact[width];
    if (!cta) { bad(where, `no visible header action-zone link to ${TICKETS_HREF}`); await ctx.close(); continue; }
    if (cta.text !== 'Tickets') bad(where, `CTA label "${cta.text}" is not "Tickets"`);
    for (const p of CTA_STYLE_PROPS) if (cta.style[p] !== base.style[p]) bad(where, `CTA ${p} ${cta.style[p]} differs from Contact's ${base.style[p]}`);
    if (Math.abs(cta.right - base.right) > 1) bad(where, `CTA right edge ${cta.right.toFixed(1)} is not Contact's slot (${base.right.toFixed(1)})`);
    if (Math.abs(cta.top - base.top) > 1 || Math.abs(cta.height - base.height) > 1) bad(where, `CTA vertical box differs from Contact's slot`);

    const h = await page.evaluate(({ tickets, bg }) => {
      const header = document.querySelector('header');
      const vis = (e) => e.checkVisibility({ checkVisibilityCSS: true });
      const filled = [...header.querySelectorAll('a')].filter((a) => vis(a) && getComputedStyle(a).backgroundColor === bg);
      const contactButton = [...header.querySelectorAll('a[href="/contact"]')].find((a) => vis(a) && !a.closest('nav,[role="dialog"]'));
      const nav = header.querySelector('nav[aria-label="Primary"]');
      const navVisible = nav && vis(nav);
      const items = navVisible ? [...nav.querySelectorAll('a,button')].filter(vis) : [];
      const contactNav = items.find((a) => a.tagName === 'A' && a.getAttribute('href') === '/contact');
      const tops = items.map((e) => Math.round(e.getBoundingClientRect().top / 3));
      const heights = items.map((e) => e.getBoundingClientRect().height);
      return {
        filledCount: filled.length, hasContactButton: !!contactButton, navVisible,
        contactNav: contactNav ? contactNav.textContent.trim() : null,
        contactLast: items.length > 0 && items[items.length - 1] === contactNav,
        sameRow: new Set(tops).size <= 1, maxH: heights.length ? Math.max(...heights) : 0,
        pill: (() => { const p = [...document.querySelectorAll('a[href="/national-show"]')].find((e) => !e.closest('header,footer,main') && vis(e)); return p ? p.getAttribute('href') : null; })(),
      };
    }, { tickets: TICKETS_HREF, bg: base.style.backgroundColor });
    if (h.filledCount !== 1) bad(where, `${h.filledCount} filled primary-style links in the header (need exactly the one CTA)`);
    if (h.hasContactButton) bad(where, 'a Contact link still sits in the action zone');
    if (width === 1280) {
      if (!h.navVisible) bad(where, 'primary nav not visible at 1280');
      if (h.contactNav !== 'Contact') bad(where, 'no "Contact" link in nav[aria-label=Primary]');
      else if (!h.contactLast) bad(where, 'Contact is not the last primary-nav item');
      if (!h.sameRow || h.maxH > 30) bad(where, `primary nav wraps (items on multiple rows or taller than 30px: ${h.maxH.toFixed(0)})`);
    }
    if (!h.pill) bad(where, 'utility-bar show pill (href /national-show) is missing');
    if (h.pill === TICKETS_HREF) bad(where, 'pill duplicates the CTA destination - the pill must be dropped in that case, and must not be kept');
    await ctx.close();
  }
}

// Provenance + keyboard at 1280 on /about.
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 900, isMobile: false });
  await open(page, '/about');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'National Show' }).click();
  const leaf = await page.evaluate(() => { const a = document.querySelector('[role="menu"] a[href="/national-show/tickets"]'); return a ? { href: a.getAttribute('href'), text: a.querySelector('[class*="font-semibold"]')?.textContent.trim() || a.textContent.trim() } : null; });
  if (!leaf) bad('1280px /about', 'Tickets leaf not found in the National Show mega');
  else if (!leaf.text.startsWith('Tickets')) bad('1280px /about', `mega Tickets leaf label "${leaf.text}" does not match the CTA label "Tickets"`);
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle' });
  const order = [];
  for (let i = 0; i < 40 && order.length < 2; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => { const a = document.activeElement; return a && a.tagName === 'A' ? a.getAttribute('href') + '|' + (a.closest('header') ? 'header' : 'other') + '|' + (a.closest('nav') ? 'nav' : 'zone') : ''; });
    if (f === '/contact|header|nav' || f === `${TICKETS_HREF}|header|zone`) order.push(f);
  }
  if (order.length < 2) bad('1280px /about', `Tab did not reach both Contact (nav) and the Tickets CTA within 40 stops: ${JSON.stringify(order)}`);
  else if (order[0] !== '/contact|header|nav') bad('1280px /about', 'Tab reaches the Tickets CTA before Contact');
  else {
    await Promise.all([page.waitForURL('**' + TICKETS_HREF, { timeout: 15000 }).catch(() => null), page.keyboard.press('Enter')]);
    if (!new URL(page.url()).pathname.startsWith(TICKETS_HREF)) bad('1280px /about', `Enter on the CTA went to ${new URL(page.url()).pathname}`);
  }
  await ctx.close();
}
await browser.close();
report(problems, `Tickets CTA, Contact-in-nav, one filled button, pill intact and keyboard path correct at ${BASE}`);
