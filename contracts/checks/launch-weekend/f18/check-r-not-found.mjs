#!/usr/bin/env node
// F18-A26 (R63, F18c): a NOS-scoped not-found for /national-show/*. Both an unmatched URL and a notFound() from a dynamic route (probes in tokens.notFound.probes) answer HTTP 404 and render
// the NOS chrome (header#nh, footer#nf, no SAOC lockup/emblem, .nos-theme scope), one h1, no stock photo, and recovery links to /national-show, /national-show/tickets and
// /national-show/plan-your-visit whose texts are the existing nav-config labels (read from components/chrome/nav-config.ts, not retyped), at 1280 and 390, no horizontal overflow.
// The SAOC not-found is unchanged: an unmatched URL outside /national-show answers 404 with the SAOC header (no #nh) and its own recovery links to / and /societies.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-r-not-found.mjs
import { NAV } from '../../../../components/chrome/nav-config.ts';
import { main, openPage, withBrowser, T } from './_lib.mjs';

const N = T.notFound;
const SAOC_LOGO = new RegExp(T.tickets.chrome.saoLogoRegex, 'i');
const STOCK = /orchid-(dark|pink|purple|violet|yellow)/i;

const labels = new Map();
(function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (typeof n.href === 'string' && typeof n.label === 'string' && !labels.has(n.href)) labels.set(n.href, n.label);
  for (const v of Object.values(n)) walk(v);
})(NAV);

await main('F18-A26 NOS not-found', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of N.probes) {
      for (const [w, h] of [[1280, 800], [390, 844]]) {
        const tag = `${route} @${w}`;
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        if (status !== 404) r.fail(`${tag}: HTTP ${status}, want 404`);
        const m = await page.evaluate(() => ({
          headers: [...document.querySelectorAll('header')].map((e) => e.id || '(none)'),
          footers: [...document.querySelectorAll('footer')].map((e) => e.id || '(none)'),
          themed: !!document.querySelector('.nos-theme'),
          h1: document.querySelectorAll('main h1').length,
          imgs: [...document.querySelectorAll('img, source')].map((e) => (e.getAttribute('src') ?? e.getAttribute('srcset') ?? '') + ' ' + (e.currentSrc || '')),
          links: [...document.querySelectorAll('main a[href]')].map((a) => ({ href: a.getAttribute('href'), text: (a.textContent ?? '').replace(/\s+/g, ' ').trim() })),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        if (m.headers.length !== 1 || m.headers[0] !== 'nh') r.fail(`${tag}: want the NOS header #nh only, got ${JSON.stringify(m.headers)}`);
        if (m.footers.length !== 1 || m.footers[0] !== 'nf') r.fail(`${tag}: want the NOS footer #nf only, got ${JSON.stringify(m.footers)}`);
        if (m.imgs.some((s) => SAOC_LOGO.test(s))) r.fail(`${tag}: a SAOC lockup/emblem image renders`);
        if (m.imgs.some((s) => STOCK.test(s))) r.fail(`${tag}: a stock photo renders on the not-found (R29: photos are route heroes only)`);
        if (!m.themed) r.fail(`${tag}: no .nos-theme scope`);
        if (m.h1 !== 1) r.fail(`${tag}: ${m.h1} h1 elements, want 1`);
        if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
        for (const l of N.links) {
          const want = labels.get(l.href);
          const hit = m.links.find((x) => x.href === l.href);
          if (!hit) r.fail(`${tag}: no recovery link to ${l.href}`);
          else if (want && hit.text.replace(/\s*[→>].*$/, '') !== want) r.fail(`${tag}: link ${l.href} reads "${hit.text}", want the nav-config label "${want}"`);
        }
        await ctx.close();
      }
    }
    const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, N.saocProbe);
    if (status !== 404) r.fail(`${N.saocProbe}: HTTP ${status}, want 404`);
    const s = await page.evaluate(() => ({ headers: [...document.querySelectorAll('header')].map((e) => e.id || '(none)'), hrefs: [...document.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href')) }));
    if (s.headers.includes('nh')) r.fail(`${N.saocProbe}: the SAOC not-found carries the NOS header (scope leaked outside /national-show)`);
    for (const h of ['/', '/societies']) if (!s.hrefs.includes(h)) r.fail(`${N.saocProbe}: the SAOC not-found lost its link to ${h}`);
    await ctx.close();
  });
});
