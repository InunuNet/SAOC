#!/usr/bin/env node
// F18-A22 (R62 #1, F18b): no brand switch at payment. the single-ticket buy screen /tickets/<slug>, /tickets/cancelled (and /tickets/confirmation when it renders without an order) carry the NOS chrome
// instead of the SAOC chrome: header#nh and footer#nf, the only banner and contentinfo, no SAOC lockup/emblem image anywhere, the .nos-theme scope around <main> content, a typographic NOS inner hero
// ([data-nos-hero="inner"][data-nos-hero-variant="type"], one h1, no photo, no card stock photo anywhere on the route), no horizontal overflow, at 1280 and 390. The SAOC site chrome stays on /about.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-n-ticket-chrome.mjs
import { main, openPage, withBrowser, T, findCheckout } from './_lib.mjs';

const K = T.tickets;
const C = K.chrome;
const STOCK = /orchid-(dark|pink|purple|violet|yellow)/i;
const SAOC_LOGO = new RegExp(C.saoLogoRegex, 'i');

function measure(c) {
  const imgs = [...document.querySelectorAll('img, source')].map((e) => (e.getAttribute('src') ?? e.getAttribute('srcset') ?? '') + ' ' + (e.currentSrc || ''));
  const heroes = [...document.querySelectorAll('[data-nos-hero]')];
  const h = document.querySelector(c.heroInner);
  return {
    headers: [...document.querySelectorAll('header')].filter((e) => e.getAttribute('role') !== 'presentation').map((e) => e.id || '(none)'),
    footers: [...document.querySelectorAll('footer')].map((e) => e.id || '(none)'),
    banner: document.querySelectorAll('header#nh').length,
    themed: !!document.querySelector('main .nos-theme, .nos-theme main, .nos-theme'),
    heroes: heroes.map((e) => `${e.getAttribute('data-nos-hero')}/${e.getAttribute('data-nos-hero-variant')}`),
    heroOk: !!h,
    h1: document.querySelectorAll('main h1').length,
    heroMedia: h ? h.querySelectorAll('img, svg, canvas, picture, video, [data-nos-hero-media]').length : 0,
    imgs,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

await main('F18-A22 NOS chrome on /tickets/*', async (r) => {
  const found = await findCheckout();
  const slugHref = found?.route ?? null;
  const routes = [...(slugHref ? [slugHref] : []), K.routes.cancelled, K.routes.confirmation];
  if (!slugHref) r.note('no purchasable /tickets/<slug> rendered (sales closed or no ticket types): the single-ticket route was not measured');
  await withBrowser(async (browser) => {
    for (const route of routes) {
      for (const [w, h] of [[1280, 800], [390, 844]]) {
        const tag = `${route} @${w}`;
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        if (status !== 200) {
          if (route === K.routes.confirmation) r.note(`${tag}: HTTP ${status} without an order: skipped (the segment rule is covered by A10/A12 and the other routes)`);
          else r.fail(`${tag}: HTTP ${status}`);
          await ctx.close();
          continue;
        }
        const m = await page.evaluate(measure, C);
        if (m.banner !== 1 || m.headers.length !== 1 || m.headers[0] !== 'nh') r.fail(`${tag}: want exactly one header and it is #nh (the NOS header); got ${JSON.stringify(m.headers)}`);
        if (m.footers.length !== 1 || m.footers[0] !== 'nf') r.fail(`${tag}: want exactly one footer and it is #nf (the NOS footer); got ${JSON.stringify(m.footers)}`);
        const saoc = m.imgs.filter((s) => SAOC_LOGO.test(s));
        if (saoc.length) r.fail(`${tag}: SAOC lockup/emblem image on a NOS route: ${[...new Set(saoc)].slice(0, 2).join(', ')}`);
        if (!m.themed) r.fail(`${tag}: no .nos-theme scope around the page (tokens and fonts would be SAOC's)`);
        if (!m.heroOk) r.fail(`${tag}: no typographic NOS inner hero (${C.heroInner}); heroes: ${JSON.stringify(m.heroes)}`);
        if (m.heroMedia) r.fail(`${tag}: the hero carries ${m.heroMedia} media element(s); the type variant has none`);
        if (m.h1 !== 1) r.fail(`${tag}: ${m.h1} h1 elements, want 1`);
        const photos = m.imgs.filter((s) => STOCK.test(s));
        if (photos.length) r.fail(`${tag}: stock photo on a ticket route (hero or card): ${[...new Set(photos)].slice(0, 2).join(', ')}`);
        if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
        await ctx.close();
      }
    }
    const { ctx, page } = await openPage(browser, { width: 1280, height: 800 }, '/about');
    const a = await page.evaluate(() => [...document.querySelectorAll('header')].map((e) => e.id || '(none)'));
    if (a.includes('nh')) r.fail('/about carries the NOS header: the SAOC chrome must be unchanged outside /national-show and /tickets');
    await ctx.close();
  });
});
