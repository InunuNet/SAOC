// Shared helpers for the launch-weekend F12 checks (R68 hub hero, R69 grouped index, R70 symposium + show-page template).
// Run from the implementation worktree root (built on F3's tip), after `SITE_PUBLIC_LAUNCH=true pnpm build`:
//   node --import tsx/esm contracts/checks/launch-weekend/f12/<check>.mjs
// The server is spawned by the NOS F3 lib (`next start`, SITE_PUBLIC_LAUNCH=true) on F12_PORT (default 3632; never 3000/3002),
// or NOS_REUSE_SERVER=1 with NOS_BASE=http://localhost:<port> against a server you started. Exit 1 = finding, 2 = infrastructure.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

process.env.NOS_PORT = process.env.F12_PORT || process.env.NOS_PORT || '3632';
const f3 = await import('../../nos-own-brand-chrome/f3/_f3lib.mjs');

export const { main, openPage, withBrowser, BASE, NOS_ROUTES, norm, rgbOf, rgbNear, firstFamily } = f3;

export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f12';
export const readGolden = (name) => JSON.parse(readFileSync(`${GOLDEN_DIR}/${name}`, 'utf8'));
export const V = readGolden('values.json');
export const COPY = readGolden('copy.json');
export const GROUPS = readGolden('hub-index-groups.json');

export const VP = { desktop: { width: 1280, height: 800 }, wide: { width: 1920, height: 1080 }, phone: { width: 390, height: 844 } };
export const HUB = '/national-show';
export const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
export const RULE = V.tokens.ruleRgb;
export const ACCENT = V.tokens.accentRgb;
export const INK = V.tokens.inkRgb;
export const BONE = V.tokens.boneRgb;

// The diff base: F3's tip. F12_BASE_REF pins one explicitly; otherwise the merge-base with F3's branch, else origin/main.
export function baseRef() {
  if (process.env.F12_BASE_REF) return process.env.F12_BASE_REF;
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  for (const ref of ['feat/nos-f3-hub-tickets', 'origin/main']) {
    try { return git('merge-base', 'HEAD', ref); } catch { /* try the next */ }
  }
  console.error('INFRA: no base ref (set F12_BASE_REF)');
  process.exit(2);
}
export const gitLines = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);

// In-page: width in px of `n`ch in the element's own font (computed lengths in ch resolve to px).
export const CH_FN = `(el, n) => {
  const cs = getComputedStyle(el);
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;width:' + n + 'ch;font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize + ';font-weight:' + cs.fontWeight + ';font-style:' + cs.fontStyle + ';letter-spacing:' + cs.letterSpacing + ';';
  el.parentElement.appendChild(d);
  const w = d.getBoundingClientRect().width;
  d.remove();
  return w;
}`;
export const trackCount = (tpl) => (tpl && tpl !== 'none' ? tpl.trim().split(/\s+/).length : 0);
export const px = (s) => parseFloat(s);
