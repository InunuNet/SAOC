// SAOC (non-National-Show) routes the F19 design pass covers. CRITIQUE_ROUTES is the impeccable loop set; the legal pages
// are measured for the axis as NOTE only (a centred reading column, outside the F19 hard scope).
export const SAOC_ROUTES = ['/', '/about', '/societies', '/events', '/judging', '/contact', '/sponsors', '/members', '/media-kit'];
export const CRITIQUE_ROUTES = ['/', '/judging', '/societies', '/events', '/about', '/contact', '/sponsors', '/members'];
export const LEGAL_ROUTES = ['/constitution', '/privacy', '/terms', '/refunds'];
export const routeSlug = (r) => (r === '/' ? 'home' : r.slice(1).replace(/\//g, '-'));

// In-page: the set of visible leaf texts in <main> (numeric-only strings and the show band, whose countdown ticks, excluded;
// curly quotes folded to straight) - the F19 "no new copy" fingerprint.
export const LEAF_TEXT_SRC = `(() => {
  const out = new Set(); const main = document.querySelector('main');
  const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode; const t = n.textContent.replace(/[\\u2018\\u2019]/g, "'").replace(/\\s+/g, ' ').trim();
    if (!t || /^[0-9:., ]+$/.test(t) || n.parentElement.closest('[data-home-section="show-band"], script, style, noscript')) continue;
    out.add(t);
  }
  return [...out].sort();
})()`;
