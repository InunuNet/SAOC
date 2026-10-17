// Section extraction that works on the untouched tree and on the F14 build (text locators, no F14 hooks).
// F19: leaves inside [data-placeholder-marker] (the "Not confirmed by SAOC" markers the beta preview shows, A22) are not copy and are skipped.
// Shared by capture-golden.mjs, check-g-others.mjs and check-i-copy.mjs. The four F14 sections are located by their
// own copy: nav (h2 "Four ways into SAOC"), band (h2 with "National Orchid Show"), yearbook (h2 with "yearbook"),
// partners (eyebrow "In collaboration with"). Everything else in <main> is "others".
export const NAV_H2 = 'Four ways into SAOC';
export const BAND_H2 = 'National Orchid Show';
export const YEARBOOK_H2 = 'yearbook';
export const PARTNERS_EYEBROW = 'In collaboration with';

// In-page source: returns { nav, band, yearbook, partners: [leaf texts], others: { key: html } }.
export const EXTRACT_SRC = `(() => {
  const main = document.querySelector('main');
  const secs = [...main.children].filter((e) => e.tagName === 'SECTION');
  const h2 = (s) => { const h = s.querySelector('h1,h2'); return h ? h.textContent.trim() : ''; };
  const nav = secs.find((s) => h2(s) === ${JSON.stringify(NAV_H2)});
  const band = secs.find((s) => h2(s).includes(${JSON.stringify(BAND_H2)}));
  const yearbook = secs.find((s) => h2(s).includes(${JSON.stringify(YEARBOOK_H2)}));
  const partners = secs.find((s) => s.textContent.includes(${JSON.stringify(PARTNERS_EYEBROW)}) && !h2(s));
  const mine = new Set([nav, band, yearbook, partners]);
  const leaves = (el) => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (t && !w.currentNode.parentElement.closest('[data-placeholder-marker]')) out.push(t); } return out; };
  const norm = (html) => html.replace(/_R_[a-zA-Z0-9_]+_/g, '_R_').replace(/:r[0-9a-z]+:/g, ':r:').replace(/data-nextjs[^=]*="[^"]*"/g, '');
  const others = {};
  secs.forEach((s, i) => { if (mine.has(s)) return; others[i + ':' + (h2(s) || 'untitled').slice(0, 40)] = norm(s.outerHTML); });
  others['main-non-section'] = [...main.children].filter((e) => e.tagName !== 'SECTION').map((e) => norm(e.outerHTML)).join('|');
  const partnerLinks = [...partners.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')].join('|'));
  return { partnerLinks, nav: leaves(nav), band: leaves(band).filter((t) => !/^[0-9]+$/.test(t)), yearbook: leaves(yearbook), partners: leaves(partners), others };
})()`;
