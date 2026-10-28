// Shared by measure-arrow-links.mjs (writes the golden) and check-arrow-links-delta.mjs (the guard). Every link that carries an arrow, whether the F1d text glyph U+2192 or the new
// svg[data-glyph="arrow"], on /societies, /judging and Home at 1440 and 390: link height, the label text's top relative to the link's top and the title's line count (the first h1-h6 in the link, else the first text node's element), in document order.
export const ARROW_ROUTES = ['/societies', '/judging', '/'];
export const ARROW_WIDTHS = [1440, 390, 2056];
export const ARROW_PROBE = `() => {
  const links = [...document.querySelectorAll('a')].filter((a) => a.getBoundingClientRect().width > 0 && (a.textContent.includes('\\u2192') || a.querySelector('svg[data-glyph="arrow"]')));
  return links.map((a) => { const r = a.getBoundingClientRect(); let top = null; const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.parentElement.closest('svg')) continue; const t = n.textContent.replace(/\\u2192/g, '').trim(); if (!t) continue; const g = document.createRange(); g.selectNodeContents(n); top = g.getBoundingClientRect().top - r.top; break; }
    const hd = a.querySelector('h1,h2,h3,h4,h5,h6') || (() => { const x = document.createTreeWalker(a, NodeFilter.SHOW_TEXT); for (let n = x.nextNode(); n; n = x.nextNode()) if (!n.parentElement.closest('svg') && n.textContent.replace(/\\u2192/g, '').trim()) return n.parentElement; return null; })();
    let tl = null; if (hd) { const g = document.createRange(); g.selectNodeContents(hd); tl = new Set([...g.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size; }
    return { titleLines: tl, label: a.textContent.replace(/\\u2192/g, '').replace(/\\s+/g, ' ').trim(), h: r.height, textTop: top }; }); }`;
