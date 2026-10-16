#!/usr/bin/env node
// F7a-A5 - chrome: mobile menu toggle exposes expanded state and the opened menu repeats no link, sticky header cannot
// hide a focused element (scroll-padding-top >= header height, WCAG 2.4.11).
import { BASE, withBrowser, open, report } from './_lib.mjs';

const problems = [];
for (const [name, vp, opts] of [['desktop', { width: 1440, height: 900 }, {}], ['mobile', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }]]) {
  await withBrowser(async (ctx) => {
    const page = await ctx.newPage();
    await open(page, '/about');
    const pad = await page.evaluate(() => {
      const h = document.querySelector('header');
      const cs = getComputedStyle(h);
      const sticky = cs.position === 'sticky' || cs.position === 'fixed';
      return { sticky, headerH: h.getBoundingClientRect().height, scrollPad: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0 };
    });
    if (pad.sticky && pad.scrollPad < pad.headerH) problems.push(`${name}: sticky header ${pad.headerH}px but html scroll-padding-top ${pad.scrollPad}px (focused elements can sit under it)`);
    // behavioural: tab down the page until an element in main is focused, it must not be covered by the header
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const top = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || !el.closest('main')) return null;
        return { top: el.getBoundingClientRect().top, headerBottom: document.querySelector('header').getBoundingClientRect().bottom };
      });
      if (top && top.top < top.headerBottom) { problems.push(`${name}: focused element at y=${top.top} is under the sticky header (bottom ${top.headerBottom})`); break; }
    }
    if (name === 'mobile') {
      await open(page, '/');
      const toggle = page.getByRole('button', { name: /open menu/i }).first();
      if ((await toggle.getAttribute('aria-expanded')) !== 'false') problems.push('mobile: menu toggle has no aria-expanded="false" when closed');
      if (!(await toggle.getAttribute('aria-controls'))) problems.push('mobile: menu toggle has no aria-controls');
      await toggle.click();
      await page.waitForTimeout(500);
      const openState = await page.evaluate(() => {
        const t = document.querySelector('button[aria-controls][aria-expanded]');
        return { expanded: t?.getAttribute('aria-expanded'), controlled: t ? !!document.getElementById(t.getAttribute('aria-controls')) : false };
      });
      if (openState.expanded !== 'true') problems.push('mobile: aria-expanded did not become "true" when the menu opened');
      if (!openState.controlled) problems.push('mobile: aria-controls does not reference an element in the DOM when open');
      const links = await page.evaluate(() => {
        const panel = document.getElementById(document.querySelector('button[aria-controls][aria-expanded]')?.getAttribute('aria-controls') || '') || document.querySelector('[role="dialog"]');
        return panel ? [...panel.querySelectorAll('a[href]')].filter((a) => a.getClientRects().length).map((a) => ({ name: (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(), href: a.getAttribute('href') })) : null;
      });
      if (!links) problems.push('mobile: opened menu panel not found');
      else {
        const seen = new Map();
        for (const l of links) {
          const k = `${l.name}|${l.href}`;
          if (seen.has(k)) problems.push(`mobile menu repeats "${l.name}" -> ${l.href}`);
          seen.set(k, true);
        }
        const byName = new Map();
        for (const l of links) byName.set(l.name, [...(byName.get(l.name) || []), l.href]);
        for (const [n, hs] of byName) if (new Set(hs).size > 1) problems.push(`mobile menu has two different links both named "${n}": ${[...new Set(hs)].join(', ')}`);
      }
    }
  }, vp, opts);
}
report(problems, `chrome checks pass at ${BASE}: aria-expanded, no repeated menu links, scroll-padding-top covers the sticky header`);
