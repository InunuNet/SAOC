// HM-7 (NOS Design 2026-10-27, corrected: the stacked column the dev built was a misreading), the event detail page: the hero facts keep their
// side-by-side row and sit on the h1's axis. Per fact cell, dt.left = dd.left (+-1, text left edges); the first cell's left edge = h1.left
// (+-1); at 390, 1440 and 2056. At >= 1024 (1440, 2056) the cells also share one row (same top +-1) with strictly increasing lefts, so a
// stacked column fails. The row is not gated at 390 (the ruling does not name it). docs/rules/no-invention.md: nothing beyond the ruling.
import { F2, GOLDEN, freeze, launchChromium, newContext, openHeroRoute, withServer } from './f2-lib.mjs';

const E = F2.eventFacts;
const route = GOLDEN.heroRoutes.find((r) => r.path === E.route);
const HERO = 'section[data-page-hero]';

await withServer(10, 'HM-7 facts alignment (saoc)', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const vp of E.viewports) {
      const context = await newContext(browser, { ...vp, dsf: 1 });
      const page = await context.newPage();
      const tag = `[saoc ${vp.name} ${E.route}]`;
      const path = await openHeroRoute(page, server, route, c, tag);
      if (!path) continue;
      await freeze(page);
      const m = await page.evaluate((hs) => {
        const textLeft = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().left; };
        const h1 = document.querySelector(`${hs} h1`).getBoundingClientRect().left;
        const cells = [...document.querySelectorAll(`${hs} [data-hero-fact]`)].map((cell) => {
          const dd = cell.querySelector('dd'); const dt = cell.querySelector('dt');
          return { cellLeft: cell.getBoundingClientRect().left, top: cell.getBoundingClientRect().top, ddLeft: textLeft(dd), dtLeft: textLeft(dt), ddAlign: getComputedStyle(dd).textAlign, text: dd.textContent.trim().slice(0, 30) };
        });
        return { h1, cells };
      }, HERO);
      c.check(`${tag} the hero renders facts to measure`, m.cells.length > 0);
      if (!m.cells.length) continue;
      c.check(`${tag} the first cell's left edge starts at the h1's left edge (cell ${m.cells[0].cellLeft.toFixed(1)} vs h1 ${m.h1.toFixed(1)})`, Math.abs(m.cells[0].cellLeft - m.h1) <= 1);
      for (const cell of m.cells) c.check(`${tag} "${cell.text}" dt.left ${cell.dtLeft.toFixed(1)} = dd.left ${cell.ddLeft.toFixed(1)} (+-1)`, Math.abs(cell.dtLeft - cell.ddLeft) <= 1);
      if (vp.width >= E.rowFromWidth) {
        c.check(`${tag} side-by-side row: every cell on one row (tops ${m.cells.map((x) => x.top.toFixed(0)).join(',')})`, m.cells.every((x) => Math.abs(x.top - m.cells[0].top) <= 1));
        c.check(`${tag} side-by-side row: cell lefts strictly increase (${m.cells.map((x) => x.cellLeft.toFixed(0)).join(',')})`, m.cells.every((x, k) => k === 0 || x.cellLeft > m.cells[k - 1].cellLeft + 1));
      }
      await context.close();
    }
  } finally { await browser.close(); }
});
