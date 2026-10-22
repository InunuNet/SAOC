// nos-critique-r20 F4 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Goldens: goldens/f4-edits.json (widths, numbers, headings), f3-edits.json (saocRoutes, nosRoutes). Both modes; 1280, 1920 and 390. Each
// footer is measured on its own routes: the SAOC footer (the page's last <footer>) on the SAOC routes, the NOS footer (footer#nf) on the
// NOS routes. A column is the parent of its heading (the leaf element reading "Explore", "Partners" or "Stay in touch"); a row is the
// first element child of a list item in the column's list. No BASE baseline: every assertion is absolute (Codi's numbers).
//   R1  every Explore and Partners row is exactly 44px tall (+-0.5), the rows sit 44px apart (+-0.5) and the list has no row gap.
//   R2  the shared row: every Explore, Partners and WOSA row is display inline-flex, align-items center, min-height 44px, font-size 14px;
//       the WOSA link is 44px tall; the Explore and Partners rows share one colour (the column text colour).
//   R3  the three headings share one class string and sit 16px (+-1) above their column's first element.
//   R4  at 1280 and 1920: the heading tops are equal (+-1) and the first-row tops (Explore, Partners, the Stay in touch blurb) are
//       equal (+-1).
//   R5  at 390 the columns stack (one left edge, Explore above Partners above Stay in touch); R1-R3 hold there too. No horizontal
//       overflow at any width.
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f4-rendered.mjs';
const G = goldenJson('f4-edits.json');
const G3 = goldenJson('f3-edits.json');
const WOSA_HREF = 'https://wildorchids.co.za';
const failures = [];
let checks = 0;
const near = (a, b, t = 1) => Math.abs(a - b) <= t;

const measure = (page, sel, heads, wosaHref) => page.evaluate(({ sel, heads, wosaHref }) => {
  const f = sel === 'last' ? [...document.querySelectorAll('footer')].pop() : document.querySelector(sel);
  if (!f) return null;
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; };
  const style = (el) => { const s = getComputedStyle(el); return { display: s.display, alignItems: s.alignItems, minHeight: s.minHeight, fontSize: s.fontSize, color: s.color }; };
  const leaf = (t) => [...f.querySelectorAll('div, h2, h3, h4')].find((el) => el.children.length === 0 && el.textContent.replace(/\s+/g, ' ').trim() === t) ?? null;
  const out = { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  for (const [key, text] of Object.entries(heads)) {
    const h = leaf(text);
    if (!h) { out[key] = null; continue; }
    const col = h.parentElement;
    const next = h.nextElementSibling;
    const ul = key === 'touch' ? null : col.querySelector(':scope > ul');
    out[key] = {
      head: box(h), cls: h.className, first: next ? box(next) : null,
      gap: ul ? getComputedStyle(ul).rowGap : null,
      rows: ul ? [...ul.children].map((li) => ({ li: box(li), row: li.firstElementChild ? { ...box(li.firstElementChild), style: style(li.firstElementChild) } : null })) : [],
    };
  }
  const wosa = [...f.querySelectorAll('a')].find((a) => a.getAttribute('href') === wosaHref);
  out.wosa = wosa ? { ...box(wosa), style: style(wosa) } : null;
  return out;
}, { sel, heads, wosaHref });

function judge(m, at, width) {
  if (!m) { failures.push(`${at}: footer not measurable (INFRA)`); return; }
  const keys = ['explore', 'partners', 'touch'];
  for (const k of keys) if (!m[k]) failures.push(`${at}: no "${G.headings[k]}" heading (R3)`);
  if (keys.some((k) => !m[k])) return;
  // R1 + R2 (rows)
  const colour = {};
  for (const k of ['explore', 'partners']) {
    const c = m[k];
    if (c.rows.length === 0) failures.push(`${at}: the ${G.headings[k]} column has no list rows (R1)`);
    if (c.gap !== null && c.gap !== 'normal' && parseFloat(c.gap) !== 0) failures.push(`${at}: the ${G.headings[k]} list has a ${c.gap} row gap, want none (R1)`);
    c.rows.forEach((r, i) => {
      if (!r.row) { failures.push(`${at}: ${G.headings[k]} row ${i + 1} has no element (R1)`); return; }
      if (!near(r.row.h, G.rowHeight, 0.5)) failures.push(`${at}: ${G.headings[k]} row ${i + 1} is ${r.row.h.toFixed(1)}px, want ${G.rowHeight} (R1)`);
      if (i > 0 && !near(r.li.y - c.rows[i - 1].li.y, G.rowHeight, 0.5)) failures.push(`${at}: ${G.headings[k]} rows ${i} -> ${i + 1} are ${(r.li.y - c.rows[i - 1].li.y).toFixed(1)}px apart, want ${G.rowHeight} (R1)`);
      const s = r.row.style;
      if (s.display !== 'inline-flex' || s.alignItems !== 'center' || s.minHeight !== `${G.rowHeight}px` || s.fontSize !== G.rowFontSize) failures.push(`${at}: ${G.headings[k]} row ${i + 1} is ${s.display}/${s.alignItems}/min-height ${s.minHeight}/${s.fontSize}, want inline-flex/center/${G.rowHeight}px/${G.rowFontSize} (R2)`);
      (colour[s.color] ??= []).push(`${G.headings[k]} ${i + 1}`);
    });
  }
  if (Object.keys(colour).length > 1) failures.push(`${at}: the Explore and Partners rows carry ${Object.keys(colour).length} colours ${JSON.stringify(colour)}, want one (R2)`);
  const w = m.wosa;
  if (!w) failures.push(`${at}: no WOSA link (R2)`);
  else if (w.style.display !== 'inline-flex' || w.style.alignItems !== 'center' || w.style.minHeight !== `${G.rowHeight}px` || w.style.fontSize !== G.rowFontSize || !near(w.h, G.rowHeight, 0.5)) failures.push(`${at}: the WOSA link is ${w.style.display}/${w.style.alignItems}/min-height ${w.style.minHeight}/${w.style.fontSize}, ${w.h.toFixed(1)}px tall; want the shared 44px row (R2)`);
  // R3
  if (new Set(keys.map((k) => m[k].cls)).size !== 1) failures.push(`${at}: the headings carry different classes ${JSON.stringify(keys.map((k) => m[k].cls))} (R3)`);
  for (const k of keys) {
    const c = m[k];
    const gap = c.first ? c.first.y - (c.head.y + c.head.h) : NaN;
    if (!near(gap, G.headingGap)) failures.push(`${at}: the ${G.headings[k]} heading sits ${Number.isNaN(gap) ? 'nothing' : `${gap.toFixed(1)}px`} above its first element, want ${G.headingGap} (R3)`);
  }
  // R4 / R5
  const firstTop = (k) => (k === 'touch' ? m.touch.first?.y : m[k].rows[0]?.li.y);
  if (G.alignedWidths.includes(width)) {
    const tops = keys.map((k) => m[k].head.y);
    if (Math.max(...tops) - Math.min(...tops) > 1) failures.push(`${at}: heading tops ${tops.map((t) => t.toFixed(1)).join(' / ')}, want equal (R4)`);
    const firsts = keys.map(firstTop);
    if (firsts.some((t) => t === undefined) || Math.max(...firsts) - Math.min(...firsts) > 1) failures.push(`${at}: first-row tops ${firsts.map((t) => (t === undefined ? 'none' : t.toFixed(1))).join(' / ')}, want equal (R4)`);
  } else {
    const xs = keys.map((k) => m[k].head.x);
    if (Math.max(...xs) - Math.min(...xs) > 1 || !(m.explore.head.y < m.partners.head.y && m.partners.head.y < m.touch.head.y)) failures.push(`${at}: the columns are not stacked Explore, Partners, Stay in touch on one left edge (R5)`);
  }
  if (m.overflow > 0) failures.push(`${at}: scrolls horizontally by ${m.overflow}px (R5)`);
}

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of G.widths) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      for (const [skin, routes, sel] of [['SAOC', G3.saocRoutes, 'last'], ['NOS', G3.nosRoutes, 'footer#nf']]) {
        for (const route of routes) {
          checks += 1;
          const at = `${mode} ${skin} ${route} @${width}`;
          const r = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
          if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); continue; }
          await page.evaluate(async () => { await document.fonts.ready; });
          judge(await measure(page, sel, G.headings, WOSA_HREF), at, width);
        }
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

finish(NAME, failures, `${checks} footer captures (${MODES.join('/')}, ${G.widths.join('/')}): every Explore/Partners row 44px on one shared row, WOSA on it too, headings 16px above their first row, tops aligned at ${G.alignedWidths.join('/')}, stacked at 390.`);
