// Shared helpers for the council-design-1 checks. Browser plumbing (server start, fixture replay, openPage, check/finish) is the
// saoc-design-consistency library (the wave this feature is built on top of); this file adds the council route sets and probes.
import { societyDetail } from '../../../backlog-wave-1028/saoc-design-consistency/checks/lib.mjs';

export * from '../../../backlog-wave-1028/saoc-design-consistency/checks/lib.mjs';

export const VIEWPORTS = [390, 1440];
/** The SAOC routes the council gates walk: the ten F1e routes plus the inner pages and the media kit, the 404, and a society page. */
export const EXTRA_ROUTES = ['/refunds', '/memorandum-of-incorporation', '/media-kit', '/this-page-does-not-exist-council'];
export const FAMILY_OK = /crimson[ _-]?pro|manrope/i;

/** Every /societies/<slug> linked from the societies list (21 on the fixture build). */
export async function allSocietySlugs(base) {
  try {
    const html = await (await fetch(base + '/societies')).text();
    return [...new Set([...html.matchAll(/href="(\/societies\/[a-z0-9][a-z0-9-]*)"/g)].map((m) => m[1]))];
  } catch { return []; }
}
export { societyDetail };

/** The NOS origin that pairs with a local SAOC origin (same port, other host), or COUNCIL_NOS_BASE. */
export function nosBaseFor(base) {
  if (process.env.COUNCIL_NOS_BASE) return process.env.COUNCIL_NOS_BASE;
  return /saoc\.localhost/.test(base) ? base.replace('saoc.localhost', 'nos.localhost') : null;
}

/** Browser-side text-node walk: [{ text, family, el }] for every visible text node (and visible form controls), skipping script/style/noscript. */
export const TEXT_WALK = `() => {
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.textContent.trim()) continue; const e = n.parentElement; if (!e || e.closest('script,style,noscript,template')) continue;
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
    if (r.width === 0 || r.height === 0 || c.visibility === 'hidden' || c.display === 'none') continue;
    out.push({ text: n.textContent.trim().slice(0, 50), family: c.fontFamily, tag: e.tagName.toLowerCase(), cls: (e.getAttribute('class') || '').slice(0, 80) }); seen.add(e);
  }
  for (const e of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select')) {
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e); if (r.width === 0 || r.height === 0 || c.visibility === 'hidden') continue;
    out.push({ text: '[' + e.tagName.toLowerCase() + ']', family: c.fontFamily, tag: e.tagName.toLowerCase(), cls: (e.getAttribute('class') || '').slice(0, 80) });
  }
  return out; }`;

export const firstFamily = (stack) => stack.split(',')[0].trim().replace(/^["']|["']$/g, '');
