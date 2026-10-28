// Shared by measure-arrow-links.mjs (writes the golden) and check-arrow-links-delta.mjs (the guard). Every link that carries an arrow, whether the F1d text glyph U+2192 or the new
// svg[data-glyph="arrow"], on /societies, /judging and Home at 1440 and 390: link height and the label text's top relative to the link's top, in document order.
export const ARROW_ROUTES = ['/societies', '/judging', '/'];
export const ARROW_WIDTHS = [1440, 390];
export const ARROW_PROBE = `() => {
  const links = [...document.querySelectorAll('a')].filter((a) => a.getBoundingClientRect().width > 0 && (a.textContent.includes('\\u2192') || a.querySelector('svg[data-glyph="arrow"]')));
  return links.map((a) => { const r = a.getBoundingClientRect(); let top = null; const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.parentElement.closest('svg')) continue; const t = n.textContent.replace(/\\u2192/g, '').trim(); if (!t) continue; const g = document.createRange(); g.selectNodeContents(n); top = g.getBoundingClientRect().top - r.top; break; }
    return { label: a.textContent.replace(/\\u2192/g, '').replace(/\\s+/g, ' ').trim(), h: r.height, textTop: top }; }); }`;
