// nos-critique-r15 f3 rendered (PUBLIC production build, next start 3010-3019 minus 3013). QA input, hash-locked. Widths 1280 and 390.
//   R1  /refunds: axe-core color-contrast reports 0 violations, and all supCount "provisional" sups are present.
//   R2  the 404 eyebrow ("404 — Page not found") on the root not-found and on the marketing not-found (a missing society): its text colour,
//       composited on a canvas, against EVERY background pixel under the text's own glyph box (+pad px), captured with the text made
//       transparent, reaches minRatio. The worst pixel decides (axe cannot evaluate an image background).
import { readFileSync } from 'node:fs';

import { finish, goldenJson } from './_lib.mjs';
import { axeSource, require, serve } from './_server.mjs';
import { IN_PAGE_PIXELS, IN_PAGE_RESOLVE, ratio, round2 } from './_color.mjs';

const { chromium } = require('playwright');
const NAME = 'f3-rendered.mjs';
const G = goldenJson('f3-edits.json');
const WIDTHS = [1280, 390];
const failures = [];
const notes = [];

const srv = await serve('public');
if (srv.failures) finish(NAME, srv.failures);
const axe = readFileSync(axeSource(), 'utf8');
const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    // R1
    let res = await page.goto(`${srv.origin}${G.refunds.route}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) failures.push(`${G.refunds.route} @${width}: HTTP ${res ? res.status() : 'none'}`);
    else {
      const sups = await page.locator(G.refunds.sup).count();
      if (sups !== G.refunds.supCount) failures.push(`${G.refunds.route} @${width}: ${sups} provisional sups, want ${G.refunds.supCount} (R1)`);
      await page.addScriptTag({ content: axe });
      const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } })).violations);
      for (const viol of v) for (const n of viol.nodes) failures.push(`${G.refunds.route} @${width}: color-contrast ${n.target.join(' ')} — ${(n.any[0]?.message || '').slice(0, 120)} (R1)`);
    }
    // R2
    for (const route of G.notFound.routes) {
      res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 404) { failures.push(`${route} @${width}: HTTP ${res ? res.status() : 'none'}, want 404`); continue; }
      await page.evaluate(async () => { await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))); });
      const info = await page.evaluate((text) => {
        const p = [...document.querySelectorAll('main p')].find((e) => e.textContent.trim() === text);
        if (!p) return null;
        const range = document.createRange(); range.selectNodeContents(p);
        const r = range.getBoundingClientRect();
        const color = getComputedStyle(p).color;
        p.style.color = 'transparent';
        return { color, box: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height } };
      }, G.notFound.text);
      if (!info) { failures.push(`${route} @${width}: no "${G.notFound.text}" eyebrow (R2)`); continue; }
      const pad = G.notFound.pad;
      const clip = { x: Math.max(0, Math.floor(info.box.x) - pad), y: Math.floor(info.box.y) - pad, width: Math.ceil(info.box.w) + 2 * pad, height: Math.ceil(info.box.h) + 2 * pad };
      const png = await page.screenshot({ clip });
      const { px } = await page.evaluate(`(${IN_PAGE_PIXELS})(${JSON.stringify(png.toString('base64'))})`);
      let worst = Infinity; let worstPx = null;
      const distinct = [...new Map(px.map((p) => [p.join(','), p])).values()];
      for (const bg of distinct) {
        const fg = await page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(info.color)}, ${JSON.stringify(bg)})`);
        const r = ratio(fg, bg);
        if (r < worst) { worst = r; worstPx = { fg, bg }; }
      }
      notes.push(`${route} @${width} worst ${round2(worst)}:1`);
      if (worst < G.notFound.minRatio) failures.push(`${route} @${width}: eyebrow ${info.color} -> rgb(${worstPx.fg}) on its worst background pixel rgb(${worstPx.bg}) = ${round2(worst)}:1, want >= ${G.notFound.minRatio} (R2)`);
    }
    await ctx.close();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  await browser.close();
  await srv.stop();
}
finish(NAME, failures, `/refunds has 0 color-contrast violations at ${WIDTHS.join('/')}; the 404 eyebrow holds >= ${G.notFound.minRatio}:1 on every background pixel (${notes.join(', ')}).`);
