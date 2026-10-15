// Shared helpers for the nos-audit-fixes F2 (ticket repoint) checks. QA inputs written by
// @architect; @dev must not edit them. Static source checks only: no network, no Sanity.
// Self-contained on purpose, so F1's _lib.mjs can change without moving these checks.
//
// NOS_AF_ROOT overrides the scanned tree, so each check can be run against an exported copy
// of the base (047d610e at authoring, 9e619821 since the rebase; or a deliberately wrong fix) to prove it fails there. Unset in the gate.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The git worktree these scripts live in (always; NOS_AF_ROOT does not move it). */
export const worktreeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const repoRoot = process.env.NOS_AF_ROOT ? path.resolve(process.env.NOS_AF_ROOT) : worktreeRoot;

// Rebased 2026-10-15: the branch now sits on origin/main 9e619821 (which contains the original
// base 047d610e plus upstream F7 and the chrome lockup). Base-relative guards mean "this branch
// did not change X", so they compare against the rebase base.
export const BASE_SHA = '9e619821';
export const NOS_ROUTE_DIR = 'app/(marketing)/national-show';
export const NOS_TICKETS_PATH = '/national-show/tickets';

/** File text, or null when the file does not exist. */
export function readRepoFile(relPath) {
  const abs = path.join(repoRoot, relPath);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

/** Source with JSX, block and line comments removed (URLs inside strings survive). */
// Each comment is replaced by its own newlines, so offsets map to the original line numbers.
export function stripComments(src) {
  const keepLines = (c) => c.replace(/[^\n]/g, '');
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, keepLines)
    .replace(/\/\*[\s\S]*?\*\//g, keepLines)
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

/** Every file under relDir (relative to repoRoot) whose name matches `re`, as repo-relative paths. */
export function walk(relDir, re) {
  const out = [];
  const absDir = path.join(repoRoot, relDir);
  if (!existsSync(absDir)) return out;
  for (const name of readdirSync(absDir)) {
    const rel = path.posix.join(relDir, name);
    if (statSync(path.join(repoRoot, rel)).isDirectory()) out.push(...walk(rel, re));
    else if (re.test(name)) out.push(rel);
  }
  return out;
}

/** 1-based line number of string offset `i` in `src`. */
export function lineOf(src, i) {
  return src.slice(0, i).split('\n').length;
}

export function fail(id, problems) {
  console.error(`FAIL ${id}`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

export function pass(id, note) {
  console.log(`PASS ${id}${note ? ` — ${note}` : ''}`);
}

// D4 (lead 2026-10-15, Codex QA P2): when no public admission product exists, the
// /national-show/tickets admission card falls back to base's button, verbatim, so the
// section never dead-ends. These are the only bare /tickets links allowed on NOS surfaces.
export const NOS_TICKETS_PAGE_FILE = 'app/(marketing)/national-show/tickets/page.tsx';
const FALLBACK_BUTTON = String.raw`<Button\s+as=\{Link\}\s+href="/tickets"\s+variant="primary"\s+className="w-fit"\s*>\s*Get visitor tickets\s*</Button>`;

/**
 * [start, end] of the base "Get visitor tickets" button in `src`, but only when it is
 * rendered solely for an empty product list `L` (L = filterPubliclyListableTicketTypes(...)):
 *   {L.length > 0 ? (...) : (FALLBACK)}   {L.length === 0 ? (FALLBACK) : (...)}
 *   {L.length === 0 && (FALLBACK)}
 * Returns null when the fallback is missing, altered, or not gated on L being empty.
 */
export function emptyListFallbackSpan(src) {
  const lists = [...src.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*filterPubliclyListableTicketTypes\(/g)].map((m) => m[1]);
  for (const L of lists) {
    const len = String.raw`${L}\.length`;
    const forms = [
      new RegExp(String.raw`\{\s*${len}\s*(?:>\s*0|!==\s*0)\s*\?[\s\S]*?:\s*\(?\s*(${FALLBACK_BUTTON})\s*\)?\s*\}`),
      new RegExp(String.raw`\{\s*${len}\s*===\s*0\s*(?:\?|&&)\s*\(?\s*(${FALLBACK_BUTTON})\s*\)?\s*[:}]`),
    ];
    for (const re of forms) {
      const m = re.exec(src);
      if (!m) continue;
      const start = m.index + m[0].indexOf(m[1]);
      return [start, start + m[1].length];
    }
  }
  return null;
}
