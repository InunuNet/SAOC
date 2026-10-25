// F9 P1 rendered: the countdown fits its cells on the National Show event page AND on the home ShowBand at
// 320, 360, 390 and 414 (CSS px, dpr 1; the query is width-driven).
//   - every [data-countdown-cell]: scrollWidth <= clientWidth (+1); its label and value scrollWidth <= clientWidth (+1);
//     label and value text right edges <= the cell's right edge (+0.5)
//   - the cells never overlap one another and the countdown never exceeds the viewport
//   - where the countdown box is under 300px wide the cells are 2x2 in reading order (DAYS HOURS / MINUTES SECONDS);
//     where it is 400px or wider they sit on one row. Between 300 and 400 either layout is accepted, except the home band at 390 and 414, which must stay four across (the ruling: where it already fits the query is a no-op).
// Run as: node contracts/checks/polish-wave-2026-10-25/f9-countdown-rendered.mjs   (needs a current build)
import { finish } from './_lib.mjs';
import { buildProblem, require, startServer } from './_server.mjs';
import { findEventSlugs } from './f9-shared.mjs';

const failures = [];
const stale = buildProblem(['components/home/ShowBand.tsx']);
if (stale.length) finish('f9-countdown-rendered', stale);

const { chromium } = require('playwright');
const WIDTHS = [320, 360, 390, 414];
const TOL = 1;

const srv = await startServer();
const browser = await chromium.launch();
try {
  const { showSlug } = await findEventSlugs(srv.port);
  if (!showSlug) failures.push('no National Show event link on /events; check cannot run');
  const pages = [{ name: 'home', path: '/' }, ...(showSlug ? [{ name: `event /events/${showSlug}`, path: `/events/${showSlug}` }] : [])];

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const p of pages) {
      const tag = `${width} ${p.name}`;
      const r = await page.goto(`http://localhost:${srv.port}${p.path}`, { waitUntil: 'load', timeout: 30000 });
      if (!r || r.status() !== 200) { failures.push(`${tag}: HTTP ${r ? r.status() : 'none'}`); continue; }
      await page.evaluate(() => document.fonts.ready);
      const boxes = await page.evaluate(() => {
        const textRight = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect().right; };
        return [...document.querySelectorAll('[data-show-band-countdown]')].map((box) => {
          const b = box.getBoundingClientRect();
          return {
            left: b.left, right: b.right, width: b.width,
            cells: [...box.querySelectorAll('[data-countdown-cell]')].map((cell) => {
              const c = cell.getBoundingClientRect();
              const value = cell.querySelector('[data-countdown-value]');
              const label = cell.lastElementChild;
              return {
                label: label.textContent.trim(), left: c.left, right: c.right, top: Math.round(c.top),
                cellOverflow: cell.scrollWidth - cell.clientWidth,
                labelOverflow: label.scrollWidth - label.clientWidth, valueOverflow: value.scrollWidth - value.clientWidth,
                labelRight: textRight(label), valueRight: textRight(value),
              };
            }),
          };
        });
      });
      if (boxes.length !== 1) { failures.push(`${tag}: ${boxes.length} countdown boxes, want 1`); continue; }
      const [box] = boxes;
      if (box.cells.length !== 4) { failures.push(`${tag}: ${box.cells.length} countdown cells, want 4 (is the show date set?)`); continue; }
      if (box.right > width + 0.5 || box.left < -0.5) failures.push(`${tag}: countdown spans ${box.left.toFixed(1)}..${box.right.toFixed(1)}, outside the ${width}px viewport`);
      for (const c of box.cells) {
        if (c.cellOverflow > TOL) failures.push(`${tag}: ${c.label} cell scrollWidth exceeds clientWidth by ${c.cellOverflow}px`);
        if (c.labelOverflow > TOL) failures.push(`${tag}: ${c.label} label is wider than its cell by ${c.labelOverflow}px`);
        if (c.valueOverflow > TOL) failures.push(`${tag}: ${c.label} value is wider than its cell by ${c.valueOverflow}px`);
        if (c.labelRight > c.right + 0.5) failures.push(`${tag}: ${c.label} label right edge ${c.labelRight.toFixed(1)} passes its cell edge ${c.right.toFixed(1)}`);
        if (c.valueRight > c.right + 0.5) failures.push(`${tag}: ${c.label} value right edge ${c.valueRight.toFixed(1)} passes its cell edge ${c.right.toFixed(1)}`);
      }
      for (const a of box.cells) {
        for (const b of box.cells) {
          if (a !== b && a.top === b.top && a.left < b.left && a.right > b.left + 0.5) failures.push(`${tag}: ${a.label} and ${b.label} cells overlap`);
        }
      }
      const order = box.cells.map((c) => c.label.toLowerCase()).join(',');
      const sorted = [...box.cells].sort((a, b) => a.top - b.top || a.left - b.left).map((c) => c.label.toLowerCase()).join(',');
      if (order !== 'days,hours,minutes,seconds' || sorted !== order) failures.push(`${tag}: cells read ${sorted}, want days,hours,minutes,seconds in reading order`);
      const rows = new Set(box.cells.map((c) => c.top)).size;
      if (box.width < 300 && (rows !== 2 || box.cells.filter((c) => c.top === box.cells[0].top).length !== 2)) failures.push(`${tag}: countdown is ${box.width.toFixed(0)}px wide and shows ${rows} row(s), want 2x2`);
      if (p.name === 'home' && width >= 390 && rows !== 1) failures.push(`${tag}: home countdown is ${box.width.toFixed(0)}px wide and shows ${rows} rows, want four across (it already fits; the query must be a no-op there)`);
      if (box.width >= 400 && rows !== 1) failures.push(`${tag}: countdown is ${box.width.toFixed(0)}px wide and wraps to ${rows} rows, want one row`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f9-countdown-rendered', failures);
