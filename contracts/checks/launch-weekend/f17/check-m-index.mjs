#!/usr/bin/env node
// F17-A19 (scope G1), AMENDED by F18 (R74 #2): the "Explore the show" index renders on every inner route and NOT on the hub (the hub has its own section links), and the old ShowSectionNav renders nowhere. On each of the hub and the 16 inner routes
// (goldens/f17/tokens.json exploreIndex) at 1280 and 390: exactly one nav[aria-label="Explore the show pages"] inside <main>, carrying the eyebrow "Explore the show" once, the same set
// of destination links on every page, after every content <section> in document order, with its own route marked aria-current="page"; no nav[aria-label="National Show section"] (the
// retired ShowSectionNav); and the raw server HTML of each route (no JavaScript) already contains the index, so it cannot be a client-only flip.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3662 node --import tsx/esm contracts/checks/launch-weekend/f17/check-m-index.mjs
import { main, openPage, withBrowser, T, BASE } from './_lib.mjs';

const X = T.exploreIndex;

function read(x) {
  const idx = [...document.querySelectorAll(`main ${x.selector}, ${x.selector}`)].filter((n, i, a) => a.indexOf(n) === i);
  const nav = idx[0];
  const secs = [...document.querySelectorAll('main section')];
  const hrefs = nav ? [...nav.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).sort() : [];
  return {
    count: idx.length,
    inMain: !!nav?.closest('main'),
    eyebrows: nav ? (nav.textContent.match(new RegExp(x.eyebrow, 'g')) ?? []).length : 0,
    hrefs,
    current: nav ? [...nav.querySelectorAll('a[aria-current="page"]')].map((a) => a.getAttribute('href')) : [],
    afterSections: !nav || secs.every((s) => !!(s.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING)),
    old: document.querySelectorAll(x.oldSelector).length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

await main('F17-A19 explore index on every route', async (r) => {
  let reference = null;
  await withBrowser(async (browser) => {
    for (const route of [X.hub, ...X.innerRoutes]) {
      const html = await (await fetch(`${BASE}${route}`, { headers: process.env.BETA_BASIC_AUTH_USER ? { authorization: `Basic ${Buffer.from(`${process.env.BETA_BASIC_AUTH_USER}:${process.env.BETA_BASIC_AUTH_PASSWORD}`).toString('base64')}` } : {} })).text();
      if (route !== X.hub && !html.includes('aria-label="Explore the show pages"')) r.fail(`${route}: the server HTML has no "Explore the show pages" index`);
      for (const [w, h] of X.viewports) {
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        const tag = `${route} @${w}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        const m = await page.evaluate(read, X);
        if (route === X.hub) {
          if (m.count !== 0) r.fail(`${tag}: the hub still renders ${m.count} "Explore the show pages" index(es), want 0 (F18 R74 #2)`);
          if (html.includes('aria-label="Explore the show pages"')) r.fail(`${route}: the server HTML of the hub still contains the index`);
          if (m.old) r.fail(`${tag}: the retired ShowSectionNav renders ${m.old} time(s)`);
          if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
          await ctx.close();
          continue;
        }
        if (m.count !== 1) r.fail(`${tag}: ${m.count} "Explore the show pages" indexes, want exactly 1`);
        if (m.count && !m.inMain) r.fail(`${tag}: the index is outside <main>`);
        if (m.count && m.eyebrows !== 1) r.fail(`${tag}: the eyebrow "${X.eyebrow}" appears ${m.eyebrows} times in the index, want 1`);
        if (m.old) r.fail(`${tag}: the retired ShowSectionNav (${X.oldSelector}) renders ${m.old} time(s)`);
        if (m.count && !m.afterSections) r.fail(`${tag}: the index is not after every content section (it belongs at the foot)`);
        if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
        if (route !== X.hub && m.count) {
          if (m.hrefs.includes(route) && !m.current.includes(route)) r.fail(`${tag}: the index lists this route but does not mark it aria-current="page" (current: ${JSON.stringify(m.current)})`);
        }
        if (m.count) {
          if (reference === null) reference = m.hrefs;
          else if (JSON.stringify(reference) !== JSON.stringify(m.hrefs)) r.fail(`${tag}: the index destination set differs from the hub's (${m.hrefs.length} vs ${reference.length} links)`);
        }
        await ctx.close();
      }
    }
  });
});
