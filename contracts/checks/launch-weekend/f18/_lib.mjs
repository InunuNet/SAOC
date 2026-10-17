// Shared helpers for the launch-weekend F18 (long-form template, holding state, ledes, FAQ, exhibitors, catalogue rows) checks.
// Run from the implementation worktree root, after `SITE_PUBLIC_LAUNCH=true pnpm run build` (never raw `next build`: the image variants must exist):
//   node --import tsx/esm contracts/checks/launch-weekend/f18/<check>.mjs        (pnpm exec tsx for the .mts render checks: they import with the "@/" alias)
// Runtime checks reuse the F17 lib (and through it the NOS F3 lib): NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 against a server you started
// (ports 3670-3679 only). Exit 1 = finding, 2 = infrastructure. cwd = the tree under test. Runtime checks read the CMS read-only and never mutate it.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

process.env.F17_PORT = process.env.F18_PORT || process.env.F17_PORT || '3672';
const f17 = await import('../f17/_lib.mjs');

export const { main, openPage, withBrowser, BASE, norm, near, VP } = f17;

export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f18';
export const readGolden = (name) => JSON.parse(readFileSync(`${GOLDEN_DIR}/${name}`, 'utf8'));
export const T = readGolden('tokens.json');

// The single-ticket checkout page keeps its route (design-cb); the repo serves it at /tickets/<slug>, the lead names /national-show/tickets/<slug>. Whichever answers 200 with the form wins.
export const CHECKOUT_PATH_RE = /^\/(national-show\/)?tickets\/[^/]+$/;
export async function findCheckout() {
  for (const slug of T.tickets.slugCandidates) {
    for (const base of ['/tickets/', '/national-show/tickets/']) {
      const x = await fetchHtml(`${base}${slug}`);
      if (x.status === 200 && x.html.includes('data-nos-ticket-form')) return { slug, route: `${base}${slug}` };
    }
  }
  return null;
}
export const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
export const gitLines = (...a) => git(...a).split('\n').filter(Boolean);
export const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

// The diff base: F18_BASE_REF pins the commit the dev branched from (main 63f3e74d plus this spec branch merged in).
export function baseRef() {
  if (process.env.F18_BASE_REF) return process.env.F18_BASE_REF;
  console.error('INFRA: set F18_BASE_REF to the commit the F18 dev branched from (the spec records main 63f3e74d)');
  process.exit(2);
}

// Typographic normalisation for copy comparison: straight and curly quotes and all whitespace compare equal, the words may not differ.
export const flat = (t) => (t ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

export const httpAuth = () => (process.env.BETA_BASIC_AUTH_USER ? { authorization: `Basic ${Buffer.from(`${process.env.BETA_BASIC_AUTH_USER}:${process.env.BETA_BASIC_AUTH_PASSWORD}`).toString('base64')}` } : {});
export async function fetchHtml(route) {
  const res = await fetch(`${BASE}${route}`, { headers: httpAuth() });
  return { status: res.status, html: await res.text() };
}

// F18-A11: every (route, width) the critique evidence must cover: the page routes at 390/1280 plus the keepsake ticket routes at the five v13 widths.
export function critiquePairs() {
  const pairs = new Map();
  for (const route of T.critique.routes) for (const w of T.critique.viewports) pairs.set(`${w}-${route.split('/').pop()}`, { route, w });
  for (const route of T.critique.ticketRoutes) for (const w of T.critique.ticketViewports) pairs.set(`${w}-${route.split('/').pop()}`, { route, w });
  return [...pairs.values()];
}
