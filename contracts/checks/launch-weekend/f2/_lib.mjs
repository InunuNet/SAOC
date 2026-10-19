// Shared helpers for launch-weekend F2 (R26: Tickets header CTA on the SAOC chrome).
// Runtime checks against BASE_URL (default http://localhost:3002), same conventions as ../f1/_lib.mjs.
import { readFileSync } from 'node:fs';
export { BASE, VIEWPORTS, launch, newPage, open, report } from '../f1/_lib.mjs';

export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f2';
export const PAGES = ['/', '/societies', '/about', '/contact'];
export const TICKETS_HREF = '/national-show/tickets';
export const CTA_STYLE_PROPS = ['backgroundColor', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'borderRadius', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

export function loadGolden() {
  return JSON.parse(readFileSync(`${GOLDEN_DIR}/header-baseline.json`, 'utf8'));
}

// In-page: the header's action-zone link to `href` that is NOT inside the primary nav or a menu.
export function actionLinkInPage(href, styleProps) {
  const header = document.querySelector('header');
  if (!header) return null;
  const a = [...header.querySelectorAll(`a[href="${href}"]`)].find((e) => !e.closest('nav,[role="menu"],[role="dialog"]') && e.checkVisibility({ checkVisibilityCSS: true }));
  if (!a) return null;
  const r = a.getBoundingClientRect();
  const cs = getComputedStyle(a);
  return { text: a.textContent.trim(), style: Object.fromEntries(styleProps.map((p) => [p, cs[p]])), right: r.right, top: r.top, height: r.height, width: r.width };
}

// In-page: identity of everything outside the header and the mobile menu dialog.
export function outsideHeaderInPage() {
  const rows = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('header,[role="dialog"],nextjs-portal,script,style,noscript,a[href="#main-content"]')) continue;
    if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    if (/^\d{1,3}$/.test(el.textContent.trim())) continue; // live countdown digits change width between loads
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    rows.push({ t: el.tagName.toLowerCase(), x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), s: [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.color, cs.backgroundColor].join('|') });
  }
  const header = document.querySelector('header');
  return { rows, headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0, scrollHeight: document.documentElement.scrollHeight };
}
