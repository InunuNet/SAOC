// Shared helpers for the nos-critique-r5 checks (QA inputs, written by @architect; @dev must
// not edit them — goldens/checks.sha256 locks them).
//
// NOS_CR5_ROOT overrides the repo root so a static check can be run against a fixture copy
// (mutation proof). Unset in the gate.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = 'ee366553'; // origin/main this r5 worktree branches from (r4 merged)
export const repoRoot = process.env.NOS_CR5_ROOT
  ? path.resolve(process.env.NOS_CR5_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/** The git worktree, never overridden: base file contents always come from git. */
export const gitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const NS = 'app/(marketing)/national-show';
export const VENDORS = `${NS}/vendors/page.tsx`;
export const EXHIBITORS = `${NS}/exhibitors/page.tsx`;
export const LIST = 'components/show/ShowFaqList.tsx';
export const DOC = 'docs/nos-critique-r5.md';
export const NAV_LABEL = 'FAQ categories';

export function readRepoFile(rel) {
  const abs = path.join(repoRoot, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

export function readBaseFile(rel) {
  return execFileSync('git', ['-C', gitRoot, 'show', `${BASE}:${rel}`], { encoding: 'utf8' });
}

/** Source with comments removed (block, JSX block, and // line comments). */
export function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

/**
 * Human-readable copy in a TSX file: string literals and JSX text, minus imports and
 * className / data-* / href / id / key attribute values. Copy has a capital start and a
 * space, or two plain words.
 */
export function copyStrings(src) {
  const s = stripComments(src)
    .replace(/^\s*import[\s\S]*?from\s*'[^']*';/gm, '')
    .replace(/\b(className|data-[\w-]+|href|id|key|rel|target|as|query|path|aria-controls|aria-labelledby)=("[^"]*"|\{`[^`]*`\}|\{'[^']*'\})/g, '');
  const out = [];
  const lit = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = lit.exec(s)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  const jsxText = />([^<>{}]+)(?=[<{])/g;
  while ((m = jsxText.exec(s)) !== null) out.push(m[1]);
  return out.map((t) => t.replace(/\s+/g, ' ').trim()).filter(isCopy);
}

function isCopy(t) {
  if (!/ /.test(t)) return false;
  if (/^[A-Z]/.test(t)) return true;
  const words = t.split(' ').filter((w) => /^[A-Za-z][a-z’']*[.,;:!?]?$/.test(w));
  return words.length >= 2;
}

export function finish(name, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${name}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
