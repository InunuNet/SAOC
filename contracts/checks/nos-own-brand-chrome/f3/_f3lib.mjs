// Shared helpers for the nos-own-brand-chrome F3 checks (structure C1/C2, hub R27, sub-nav R27, vendors R27, imagery R29, og J3).
// Run from the worktree root:  node --import tsx/esm contracts/checks/nos-own-brand-chrome/f3/<check>.mjs
// Server: spawned by ../_lib.mjs unless NOS_REUSE_SERVER=1 with NOS_BASE=http://localhost:<port> (the measured URL always comes from env).
// Every constant is cited in goldens/f3/f3-spec.md and, through it, to the NOS handoff (index.html lines, I:n) or an NOS Design ruling.
import { readFileSync } from 'node:fs';
import { NAV } from '../../../../components/chrome/nav-config.ts';
import { BASE, NOS_ROUTES, SPEC_DIR, openPage, withBrowser, VP_DESKTOP } from '../f2/_f2lib.mjs';

export * from '../f2/_f2lib.mjs';

export const F3_GOLDEN_DIR = `${SPEC_DIR}/goldens/f3`;
export const readGolden = (name) => JSON.parse(readFileSync(`${F3_GOLDEN_DIR}/${name}`, 'utf8'));

export const HUB_ROUTE = '/national-show';
export const TICKETS_ROUTE = '/national-show/tickets';
export const NO_SUBNAV_ROUTES = [HUB_ROUTE, TICKETS_ROUTE]; // R27: no sub-nav on the hub or on tickets
// Public sub-routes of the vendors flow that render without a token (the payment pages are token-gated and unspecified here).
export const VENDOR_SUBROUTES = ['/national-show/vendors/apply', '/national-show/vendors/register', '/national-show/vendors/photos'];

// ---- nav-config as the single source of group membership and labels (R27: labels verbatim from nav-config) ----
const mega = NAV.find((n) => n.type === 'mega');
export const GROUPS = [mega.lead.theShow, ...mega.columns].map((c) => ({
  heading: c.heading,
  label: `${c.heading} pages`,
  links: c.links.map((l) => ({ label: l.label, href: l.href })),
}));

// Longest-prefix leaf for a path: exact for a leaf route, a sub-route for /vendors/apply, /archive/2024, ...
export function groupFor(path) {
  let best = null;
  for (const group of GROUPS) {
    for (const leaf of group.links) {
      if (path === leaf.href || path.startsWith(leaf.href + '/')) {
        if (!best || leaf.href.length > best.leaf.href.length) best = { group, leaf, exact: path === leaf.href };
      }
    }
  }
  return best;
}

// 17 listed routes + every archive year the archive index links + the public vendor sub-routes.
export async function allRoutes(browser) {
  const probe = await openPage(browser, VP_DESKTOP, '/national-show/archive');
  const years = await probe.page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/national-show/archive/"]')].map((a) => a.getAttribute('href')))]);
  await probe.ctx.close();
  return [...NOS_ROUTES, ...years, ...VENDOR_SUBROUTES];
}

// next/image serves /_next/image?url=%2Fimages%2Forchid-dark.jpg&w=...; resolve to the underlying asset path.
export function assetPath(src) {
  if (!src) return '';
  try {
    const u = new URL(src, BASE);
    if (u.pathname === '/_next/image') return u.searchParams.get('url') ?? '';
    return u.pathname;
  } catch {
    return src;
  }
}
export const STOCK_PHOTO_RE = /\/images\/orchid-(dark|pink|purple|violet|yellow)\.jpg/i;

export const ROYAL_RGB = [33, 26, 87]; // #211A57
export const GOLD_RGB = [243, 242, 214]; // --gold #F3F2D6 (I:19)
export const GOLD_100_RGB = [251, 250, 240]; // #FBFAF0 (I:20)
export const LINE_RGB = [218, 215, 200]; // --line #DAD7C8 (I:28)
export const GREEN_1_RGB = [167, 168, 65]; // --green-1 #A7A841 (I:22)
export const BLACK_RGB = [11, 10, 20]; // --black #0B0A14 (I:18)
export const INK_700_RGB = [58, 54, 84];
export const rgbOf = (s) => (s?.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
export const rgbNear = (a, b, tol = 1.5) => a.length >= 3 && b.every((c, i) => Math.abs(a[i] - c) <= tol);
export const gutterOf = (vw) => Math.min(Math.max(16, 0.04 * vw), 48); // clamp(16px, 4vw, 48px), I:91
export const sectionPadOf = (vw) => Math.min(Math.max(72, 0.09 * vw), 120); // clamp(72px, 9vw, 120px), I:156
export const WRAP_DEFAULT = 1080; // --default, I:61

export const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
export { BASE, withBrowser };
