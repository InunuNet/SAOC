// Shared helpers for the nos-critique-r6 f6 (R34 exhibitors) and f8 (R50 what-to-expect) checks. QA inputs written by
// @architect; @dev must not edit them -- goldens/checks-f6f8.sha256 locks them. Imports _lib.mjs / _server.mjs read-only.
//
//   NOS_CR6_ROOT    worktree to inspect (default .tmp/sandbox/critique-r6), as for f1-f5
//   NOS_CR6_ORIGIN  dry-run only: an already running origin to drive instead of `next start` (skips the freshness check)
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { execFileSync } from 'node:child_process';

import { DOC, NS, gitRoot, specDir } from './_lib.mjs';
import { assertFreshBuild, startServer } from './_server.mjs';

// Batch 2 (f6, f8, f10, f7) is re-based onto main 3f45db11 (F18a merged; f1-f5 and f9 are on main). The shared BASE in _lib.mjs stays 47cf7f1b
// for the merged features' gates; these checks diff against BASE2 instead. NOS_CR6_BASE overrides it (mutation proofs).
export const BASE2 = process.env.NOS_CR6_BASE ?? '3f45db11';
export const git = (...args) => execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8' });
export function readBaseFile(rel) {
  try {
    return execFileSync('git', ['-C', gitRoot, 'show', `${BASE2}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null; // new file since BASE2
  }
}

export const golden = (name) => readFileSync(path.join(specDir, 'goldens', name), 'utf8');

// ---- the files each feature may change (stacked tree: f1..f8 in one worktree) ----
const fromJson = (name) => JSON.parse(golden(name));
// goldens/f6-, f8-, f10-footprint.json are the single source: the explicit per-feature allowlists check-footprint.mjs reads.
export const F6_PATHS = new Set(fromJson('f6-footprint.json'));
export const F8_PATHS = new Set(fromJson('f8-footprint.json'));
export const F10_PATHS = new Set(fromJson('f10-footprint.json'));
// f7 (R33) is the one other batch-2 feature in the stacked tree; f1-f5 and f9 are merged into BASE2, so any change to their files is a failure.
export const CARRY_PATHS = new Set(fromJson('batch2-carry-footprint.json')); // post-merge follow-ups that ride in this branch (f9 UtilityBar Codex P3)
const F7_PATHS = new Set([`${NS}/plan-your-visit/page.tsx`, 'components/show/VenueCard.tsx']);
export const OWNED = new Set([...F6_PATHS, ...F8_PATHS, ...F10_PATHS, ...F7_PATHS, ...CARRY_PATHS]);
export const NEW_OK = new Set([...F6_PATHS, ...F8_PATHS]);

export const OFF_LIMITS = [
  `${NS}/tickets/`, 'app/(marketing)/tickets/', 'app/api/', `${NS}/workshops/`, `${NS}/conferences/`,
  'lib/data/show-facts.ts', 'lib/data/show-page-presentation.ts', 'lib/show-identity.ts',
  'app/globals.css', 'components/chrome/', 'components/nos-chrome/', 'components/show/nos/ShowContentState.tsx',
];
// The shared long-form template, facts block and holding state: byte-identical to BASE2 (f8-static S1).
export const STRUCTURE_LOCKED = new Set(['components/nos/LongFormPage.tsx', 'components/nos/ShowFacts.tsx', 'components/show/nos/HoldingState.tsx']);

export function changedPaths() {
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const changed = new Set([...lines(git('diff', '--name-only', BASE2)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
  const added = new Set([...lines(git('diff', '--name-only', '--diff-filter=A', BASE2)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
  return { changed, added };
}

/** Footprint guard shared by f6 and f8. `own` is the feature's modify set (reported, never loosened). */
export function footprintFailures(featureLabel) {
  const failures = [];
  const { changed, added } = changedPaths();
  for (const p of changed) {
    if (p === DOC) continue;
    if (OFF_LIMITS.some((o) => p.startsWith(o)) && !OWNED.has(p)) { failures.push(`off-limits path changed: ${p}`); continue; }
    if (p.endsWith('.css')) {
      if (F10_PATHS.has(p) || F6_PATHS.has(p)) continue; // nos-structure.css (f10) and nos-theme.css (f6 token + marker rule): policed by their static checks
      failures.push(`stylesheet ${p} changed; only f10 (nos-structure.css) and f6 (nos-theme.css) may edit stylesheets`);
      continue;
    }
    if (!OWNED.has(p) && !NEW_OK.has(p)) { failures.push(`path not on batch 2's allowlist (f6, f7, f8, f10 only; f1-f5 and f9 are on main): ${p}`); continue; }
    if (added.has(p) && !NEW_OK.has(p)) { failures.push(`new file not on the allowlist: ${p}`); continue; }
  }
  try {
    git('merge-base', '--is-ancestor', BASE2, git('rev-parse', 'HEAD').trim());
  } catch {
    failures.push(`HEAD does not descend from ${BASE2}`);
  }
  return { failures, count: changed.size };
}

/** Origin to drive: NOS_CR6_ORIGIN (dry run) or a fresh `next start`. */
export async function openOrigin(sourceFiles) {
  if (process.env.NOS_CR6_ORIGIN) return { origin: process.env.NOS_CR6_ORIGIN, stop: () => {} };
  const stale = assertFreshBuild(sourceFiles);
  if (stale.length > 0) return { stale };
  const srv = await startServer();
  return { origin: srv.origin, stop: srv.stop };
}

/** Origin for one render mode. preview = SHOW_PLACEHOLDER_PREVIEW=true (beta review, wall up), public = unset. The routes are dynamic,
 *  so the setting is read per request: two servers over the one build. Dry run: NOS_CR6_ORIGIN (public) / NOS_CR6_ORIGIN_PREVIEW. */
export async function openMode(mode, sourceFiles) {
  const fixed = mode === 'preview' ? process.env.NOS_CR6_ORIGIN_PREVIEW : process.env.NOS_CR6_ORIGIN;
  if (fixed) return { origin: fixed, stop: () => {} };
  const stale = assertFreshBuild(sourceFiles);
  if (stale.length > 0) return { stale };
  process.env.SHOW_PLACEHOLDER_PREVIEW = mode === 'preview' ? 'true' : ''; // the withhold switch matches 'true' exactly
  const srv = await startServer();
  return { origin: srv.origin, stop: srv.stop };
}

/**
 * Codi (FINAL): the public holding line is the v4 R11 disclosure (golden nos-v4/index.html .disclosure). DOM contract:
 *   [data-status-disclosure]   the gold surface (role="note")
 *     the existing marker chip ([data-exhibitor-marker] / [data-confirmation-badge]) - the pill, ONE line
 *     [data-status-list]       the hidden rows' own headings, sentence case 16/1.55 ink-700, first as written, rest lower case, ending "."
 *     a[href="/contact"]       "Be the first to know" (f8) inside the same surface, after the list
 * DISCLOSURE_PROBE runs in the page and returns plain data; disclosureFailures judges it.
 */
export const DISCLOSURE_PROBE = () => {
  const css = (el, props) => { const cs = getComputedStyle(el); return Object.fromEntries(props.map((p) => [p, cs[p]])); };
  // tokens are resolved inside the surface: --gold and --ink-700 are defined on .nos-theme, not on body
  const resolveIn = (host, prop, v) => { const e = document.createElement('span'); e.style[prop] = v; host.appendChild(e); const r = getComputedStyle(e)[prop]; e.remove(); return r; };
  return [...document.querySelectorAll('[data-status-disclosure]')].map((el) => {
    const gold = resolveIn(el, 'backgroundColor', 'var(--gold)');
    const ink700 = resolveIn(el, 'color', 'var(--ink-700)');
    const chip = el.querySelector('[data-exhibitor-marker], [data-confirmation-badge]');
    const list = el.querySelector('[data-status-list]');
    const link = el.querySelector('a[href="/contact"]');
    // lines are counted from the TEXT only (never the chip's own box), clustering rects whose tops sit within half a line of each other
    let chipLines = 0;
    if (chip) {
      const tops = [];
      const w = document.createTreeWalker(chip, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); for (const x of r.getClientRects()) if (x.width > 0) tops.push(x.top); }
      const lh = parseFloat(getComputedStyle(chip).lineHeight) || parseFloat(getComputedStyle(chip).fontSize) * 1.3;
      tops.sort((a, b) => a - b);
      chipLines = tops.reduce((c, t, k) => (k === 0 || t - tops[k - 1] > lh / 2 ? c + 1 : c), 0);
    }
    const sr = el.getBoundingClientRect();
    return {
      gold, ink700,
      surface: css(el, ['backgroundColor', 'borderTopLeftRadius', 'boxShadow', 'paddingTop', 'paddingBottom', 'paddingLeft']),
      chip: chip ? { text: chip.textContent.replace(/\s+/g, ' ').replace(/^\u203b\s*/, '').trim(), lines: chipLines, marker: chip.getAttribute('data-exhibitor-marker') ?? 'confirmation', top: chip.getBoundingClientRect().top, ...css(chip, ['letterSpacing', 'paddingLeft', 'fontSize']) } : null,
      list: list ? { text: list.textContent.replace(/\s+/g, ' ').trim(), top: list.getBoundingClientRect().top, ...css(list, ['fontSize', 'lineHeight', 'color', 'textTransform']) } : null,
      link: link ? { text: link.textContent.trim(), top: link.getBoundingClientRect().top, h: link.getBoundingClientRect().height } : null,
      stray: [...document.querySelectorAll('a[href="/contact"]')].filter((a) => /be the first to know/i.test(a.textContent) && !el.contains(a)).length,
      bottom: sr.bottom, top: sr.top, width: sr.width,
    };
  });
};

/** `ds` is the DISCLOSURE_PROBE result; `want` = { marker, text (chip), list (string|null), link (bool) } for ONE surface. */
export function disclosureFailures(tag, d, vw, want) {
  const f = [];
  const num = (v) => parseFloat(v);
  if (d.surface.backgroundColor !== d.gold) f.push(`${tag}: surface fill ${d.surface.backgroundColor}, want --gold ${d.gold}`);
  if (num(d.surface.borderTopLeftRadius) !== 16) f.push(`${tag}: surface radius ${d.surface.borderTopLeftRadius}, want 16px`);
  if (!d.surface.boxShadow || d.surface.boxShadow === 'none') f.push(`${tag}: surface has no shadow-sm`);
  if (num(d.surface.paddingTop) !== 20 || num(d.surface.paddingBottom) !== 24) f.push(`${tag}: surface padding ${d.surface.paddingTop}/${d.surface.paddingBottom}, want 20/24`);
  if (vw <= 700 && num(d.surface.paddingLeft) !== 16) f.push(`${tag}: surface inline padding ${d.surface.paddingLeft} at ${vw}, want 16px`);
  if (!d.chip) { f.push(`${tag}: no marker chip inside the surface`); return f; }
  // Codi chip ruling: ONE line from 360 up; below 360 two lines are allowed. At <=700 the chip (inside the disclosure only) tightens to
  // 0.06em tracking and 10px inline padding, per the nos-v4 golden.
  const maxLines = vw < 360 ? 2 : 1;
  if (d.chip.lines > maxLines) f.push(`${tag}: the chip "${d.chip.text}" wraps onto ${d.chip.lines} lines, want ${maxLines === 1 ? 'one' : 'at most two'} at ${vw}px`);
  if (vw <= 700) {
    if (Math.abs(num(d.chip.letterSpacing) - 0.06 * num(d.chip.fontSize)) > 0.05) f.push(`${tag}: chip letter-spacing ${d.chip.letterSpacing} at ${vw}px, want 0.06em (${(0.06 * num(d.chip.fontSize)).toFixed(2)}px)`);
    if (num(d.chip.paddingLeft) !== 10) f.push(`${tag}: chip inline padding ${d.chip.paddingLeft} at ${vw}px, want 10px`);
  }
  if (want.text !== undefined && norm(d.chip.text) !== norm(want.text)) f.push(`${tag}: chip reads "${d.chip.text}", want exactly "${want.text}"`);
  if (want.list === null) { if (d.list) f.push(`${tag}: a list renders but nothing was hidden`); }
  else {
    if (!d.list) f.push(`${tag}: [data-status-list] missing inside the surface`);
    else {
      if (d.list.fontSize !== '16px') f.push(`${tag}: list font-size ${d.list.fontSize}, want 16px`);
      if (Math.abs(num(d.list.lineHeight) - 24.8) > 0.6) f.push(`${tag}: list line-height ${d.list.lineHeight}, want ~24.8px (1.55)`);
      if (d.list.color !== d.ink700) f.push(`${tag}: list colour ${d.list.color}, want ink-700 ${d.ink700}`);
      if (d.list.textTransform !== 'none') f.push(`${tag}: list text-transform ${d.list.textTransform}, want none (sentence case)`);
      if (!d.list.text.endsWith('.')) f.push(`${tag}: list "${d.list.text}" must end with "."`);
      if (d.list.top < d.chip.top) f.push(`${tag}: the list sits above the chip`);
      if (want.list !== undefined && norm(d.list.text) !== norm(want.list)) f.push(`${tag}: list reads "${d.list.text}", want exactly "${want.list}"`);
    }
  }
  if (want.link) {
    if (!d.link) f.push(`${tag}: "Be the first to know" is not inside the surface`);
    else if (d.link.h < 44) f.push(`${tag}: "${d.link.text}" target is ${d.link.h.toFixed(1)}px tall, want >=44px (inline-flex, min-h 44)`);
    else if (d.list && d.link.top < d.list.top) f.push(`${tag}: the link sits above the list; it is the last line of the surface`);
    if (d.stray > 0) f.push(`${tag}: ${d.stray} "Be the first to know" link(s) outside the surface`);
  }
  return f;
}

/** Opens `url` at `width` and returns the DISCLOSURE_PROBE result (used for the 320 narrow-phone probe). */
export async function probeAt(browser, url, auth, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, extraHTTPHeaders: { authorization: auth } });
  try {
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) return { status: res && res.status(), ds: [] };
    return { status: 200, ds: await page.evaluate(DISCLOSURE_PROBE) };
  } finally { await ctx.close(); }
}

export const norm = (t) => t.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
export { existsSync };
