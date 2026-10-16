// F3-R13 (NOS Site critique item 2, Acceptance bar C3): no card grid on any NOS route leaves a lone last-row item (4 -> 3+1, 10 -> 4+4+2 is
// fine but 5 -> 2+2+1 is not). A grid = a display:grid element in <main> with >=3 visible in-flow children and >=2 columns at the viewport.
// A last child that spans columns (grid-column span) or fills the container is the intended full-width final card and is exempt.
// All routes, widths 1280, 1024, 768, 390.
import { allRoutes, main, openPage, withBrowser } from './_f3lib.mjs';

const VPS = [[1280, 800], [1024, 768], [768, 1024], [390, 844]];

function measure() {
  const out = [];
  for (const g of document.querySelectorAll('main *')) {
    if (getComputedStyle(g).display !== 'grid' || g.closest('#nh, #nd, #nf')) continue;
    const kids = [...g.children].filter((c) => { const s = getComputedStyle(c); const r = c.getBoundingClientRect(); return r.width > 2 && r.height > 2 && s.display !== 'none' && s.position !== 'absolute' && s.position !== 'fixed'; });
    if (kids.length < 3) continue;
    const rects = kids.map((c) => c.getBoundingClientRect());
    const cols = new Set(rects.map((r) => Math.round(r.left))).size;
    if (cols < 2) continue;
    const rowsMap = new Map();
    rects.forEach((r, i) => { const k = Math.round(r.top / 4); (rowsMap.get(k) ?? rowsMap.set(k, []).get(k)).push(i); });
    const rows = [...rowsMap.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    const last = rows[rows.length - 1];
    if (last.length !== 1 || rows.length < 2) continue;
    const lastKid = kids[last[0]];
    const gc = getComputedStyle(lastKid);
    const gr = g.getBoundingClientRect();
    const spans = /span/.test(gc.gridColumnStart + gc.gridColumnEnd) || rects[last[0]].width >= gr.width - 2;
    if (!spans) out.push(`${g.tagName.toLowerCase()}.${String(g.className).slice(0, 40)}: ${kids.length} items in ${cols} columns, last row has 1`);
  }
  return out;
}

await main('F3-R13 orphans', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of await allRoutes(browser)) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      for (const [w, h] of VPS) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(100);
        for (const o of await page.evaluate(measure)) r.fail(`${route} @${w}: orphan row in ${o}`);
      }
      await ctx.close();
    }
  });
});
