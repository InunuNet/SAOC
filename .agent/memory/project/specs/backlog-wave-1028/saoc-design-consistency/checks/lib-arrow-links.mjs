// Shared by measure-arrow-links.mjs (writes the golden) and check-arrow-links-delta.mjs (the guard). Every link or button that carries an arrow, whether the F1d text glyph U+2192 or the new
// svg[data-glyph="arrow"], on every ArrowIcon caller that renders on the fixture build: link height, the label text's top relative to the link's top, and the title's line count
// (the first h1-h6 in the element, else the element itself), counted from TEXT NODES ONLY (the svg's rect and the arrow glyph never count), in document order.
import { openPage } from './lib.mjs';
export const ARROW_WIDTHS = [1440, 390, 2056];
// host: saoc (the base origin) or nos (nos.localhost on the same port). first: resolve the path from the first matching href on `from`.
export const ARROW_TARGETS = [
  { id: 'saoc:/societies', host: 'saoc', path: '/societies' }, { id: 'saoc:/judging', host: 'saoc', path: '/judging' }, { id: 'saoc:/', host: 'saoc', path: '/' },
  { id: 'saoc:/events', host: 'saoc', path: '/events' }, { id: 'saoc:/events/[first]', host: 'saoc', from: '/events', selector: 'a[href^="/events/"]' },
  { id: 'saoc:/societies/[first]', host: 'saoc', from: '/societies', selector: 'a[href^="/societies/"]' },
  { id: 'saoc:/sponsors', host: 'saoc', path: '/sponsors' },
  { id: 'nos:/tickets', host: 'nos', path: '/tickets' }, { id: 'nos:/tickets/[first]', host: 'nos', from: '/tickets', selector: 'a[href^="/tickets/"]:not([href^="/tickets/cancelled"]):not([href^="/tickets/confirmation"])' },
  { id: 'nos:/national-show/tickets', host: 'nos', path: '/national-show/tickets' }, { id: 'nos:/national-show/vendors', host: 'nos', path: '/national-show/vendors' },
  { id: 'saoc:search-overlay', host: 'saoc', path: '/', overlay: true },
];
export const ARROW_PROBE = `(root) => {
  const scope = root ? document.querySelector(root) : document;
  const els = [...scope.querySelectorAll('a, button')].filter((a) => a.getBoundingClientRect().width > 0 && (a.textContent.includes('\\u2192') || a.querySelector('svg[data-glyph="arrow"]')));
  const lineCount = (hd) => { const tops = new Set(); const x = document.createTreeWalker(hd, NodeFilter.SHOW_TEXT); for (let n = x.nextNode(); n; n = x.nextNode()) { if (n.parentElement.closest('svg')) continue; const i = n.textContent.indexOf('\\u2192'); const end = i < 0 ? n.textContent.length : i; if (!n.textContent.slice(0, end).trim()) continue; const g = document.createRange(); g.setStart(n, 0); g.setEnd(n, end); for (const q of g.getClientRects()) if (q.width > 0) tops.add(Math.round(q.top)); } return tops.size; };
  return els.map((a) => { const r = a.getBoundingClientRect(); let top = null; const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.parentElement.closest('svg')) continue; const t = n.textContent.replace(/\\u2192/g, '').trim(); if (!t) continue; const g = document.createRange(); g.selectNodeContents(n); top = g.getBoundingClientRect().top - r.top; break; }
    const hd = a.querySelector('h1,h2,h3,h4,h5,h6') || a;
    return { titleLines: lineCount(hd), label: a.textContent.replace(/\\u2192/g, '').replace(/\\s+/g, ' ').trim(), h: r.height, textTop: top }; }); }`;
// One entry per target and width: { status, links } or { status, links: [], gap } when the page does not render (or the overlay cannot be opened) on this build.
export async function collectArrowLinks({ base, browser, ctxOpts }) {
  const out = {}; const nosBase = base.replace('saoc.localhost', 'nos.localhost'); const hrefs = {};
  for (const width of ARROW_WIDTHS) for (const t of ARROW_TARGETS) {
    const origin = t.host === 'nos' ? nosBase : base; let path = t.path; const key = `${t.id}@${width}`;
    if (t.from) {
      if (!hrefs[t.id]) { const { page, ctx } = await openPage(browser, ctxOpts, origin, t.from, 1440, 900); hrefs[t.id] = await page.evaluate((s) => { const a = document.querySelector(s); return a ? a.getAttribute('href') : null; }, t.selector).catch(() => null); await ctx.close(); }
      path = hrefs[t.id]; if (!path) { out[key] = { status: 0, links: [], gap: `no ${t.selector} link on ${t.from}` }; continue; }
    }
    let opened; try { opened = await openPage(browser, ctxOpts, origin, path, width, 900); } catch (e) { out[key] = { status: 0, links: [], gap: `${path} navigation failed: ${String(e.message).split('\n')[0].slice(0, 80)}` }; continue; }
    const { page, ctx, status } = opened;
    if (status !== 200) { out[key] = { status, links: [], gap: `${path} returned ${status}` }; await ctx.close(); continue; }
    if (t.overlay) {
      const btn = page.getByRole('button', { name: /search/i }).first(); let opened = false;
      try { await btn.click({ timeout: 3000 }); await page.waitForSelector('[role=dialog]', { timeout: 3000 }); const box = page.locator('[role=dialog] input').first(); if (await box.count()) { await box.fill('orchid'); await page.waitForTimeout(1200); } opened = true; } catch { /* reported as a gap */ }
      out[key] = opened ? { status, links: await page.evaluate(`(${ARROW_PROBE})('[role=dialog]')`) } : { status, links: [], gap: 'search overlay could not be opened' };
    } else out[key] = { status, links: await page.evaluate(`(${ARROW_PROBE})()`) };
    await ctx.close();
  }
  return out;
}
