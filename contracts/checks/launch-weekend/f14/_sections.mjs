// Section extraction that works on the untouched tree and on the F14 build (text locators, no F14 hooks).
// Shared by capture-golden.mjs, check-g-others.mjs and check-i-copy.mjs.
export const NAV_H2 = 'Four ways into SAOC';
export const BAND_H2 = 'National Orchid Show';

// In-page source: returns { nav: [leaf texts], band: [leaf texts w/o countdown digits], others: { key: html } }.
export const EXTRACT_SRC = `(() => {
  const main = document.querySelector('main');
  const secs = [...main.children].filter((e) => e.tagName === 'SECTION');
  const h2 = (s) => { const h = s.querySelector('h1,h2'); return h ? h.textContent.trim() : ''; };
  const nav = secs.find((s) => h2(s) === ${JSON.stringify(NAV_H2)});
  const band = secs.find((s) => h2(s).includes(${JSON.stringify(BAND_H2)}));
  const leaves = (el) => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (t) out.push(t); } return out; };
  const norm = (html) => html.replace(/_R_[a-zA-Z0-9_]+_/g, '_R_').replace(/:r[0-9a-z]+:/g, ':r:').replace(/data-nextjs[^=]*="[^"]*"/g, '');
  const others = {};
  secs.forEach((s, i) => { if (s === nav || s === band) return; others[i + ':' + (h2(s) || 'untitled').slice(0, 40)] = norm(s.outerHTML); });
  // footer-adjacent non-section children of main (scripts, JSON-LD) are part of "others" too
  const nonSection = [...main.children].filter((e) => e.tagName !== 'SECTION').map((e) => norm(e.outerHTML)).join('|');
  others['main-non-section'] = nonSection;
  return { nav: leaves(nav), band: leaves(band).filter((t) => !/^[0-9]+$/.test(t)), others };
})()`;
