// HM-7 (NOS Design 2026-10-26), /events/[slug]: the hero facts values must be left-aligned to the h1's edge, one axis (they were centred in
// their cells under a left-aligned h1). At 2056, 1440 and 390 (the shared copy column is left-aligned at every width):
//   - the facts row starts at the h1's left edge (+-1);
//   - each value (dd) is text-align start/left and its text starts at its cell's left edge (+-1).
// The labels (dt) are measured and logged, not gated: the ruling names the values only.
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
          return { cellLeft: cell.getBoundingClientRect().left, ddLeft: textLeft(dd), dtLeft: textLeft(dt), ddAlign: getComputedStyle(dd).textAlign, text: dd.textContent.trim().slice(0, 30) };
        });
        return { h1, cells };
      }, HERO);
      c.check(`${tag} the hero renders facts to measure`, m.cells.length > 0);
      if (!m.cells.length) continue;
      c.check(`${tag} the facts row starts at the h1's left edge (cell ${m.cells[0].cellLeft.toFixed(1)} vs h1 ${m.h1.toFixed(1)})`, Math.abs(m.cells[0].cellLeft - m.h1) <= 1);
      for (const cell of m.cells) {
        c.check(`${tag} value "${cell.text}" is text-align start/left (${cell.ddAlign})`, ['left', 'start'].includes(cell.ddAlign));
        c.check(`${tag} value "${cell.text}" text starts at its cell's left edge (${cell.ddLeft.toFixed(1)} vs ${cell.cellLeft.toFixed(1)})`, Math.abs(cell.ddLeft - cell.cellLeft) <= 1);
        c.note(`note: ${tag} label of "${cell.text}" starts ${(cell.dtLeft - cell.cellLeft).toFixed(1)}px from its cell edge (not gated)`);
      }
      await context.close();
    }
  } finally { await browser.close(); }
});
