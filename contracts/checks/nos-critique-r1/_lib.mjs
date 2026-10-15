// Shared helpers for the nos-critique-r1 checks (QA inputs, written by @architect; @dev must
// not edit them — goldens/checks.sha256 locks them).
//
// NOS_CR1_ROOT overrides the repo root so a static check can be run against a fixture copy
// (mutation proof). Unset in the gate.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '1e1f5732';
export const repoRoot = process.env.NOS_CR1_ROOT
  ? path.resolve(process.env.NOS_CR1_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/** The git worktree, never overridden: base file contents always come from git. */
export const gitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const NS = 'app/(marketing)/national-show';
export const FILES = {
  sponsors: `${NS}/sponsors/page.tsx`,
  symposium: `${NS}/symposium/page.tsx`,
  wosa: `${NS}/wosa-conference/page.tsx`,
  presenters: `${NS}/presenters.css`,
};

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
 * Every human-readable copy string in a TSX file: string literals and JSX text, excluding
 * import specifiers and className / data-* / href / id / key attribute values. A "copy"
 * string contains at least one letter and one space (single tokens like 'pending' are
 * identifiers, not copy).
 */
export function copyStrings(src) {
  let s = stripComments(src)
    .replace(/^\s*import[\s\S]*?from\s*'[^']*';/gm, '')
    .replace(/\b(className|data-[\w-]+|href|id|key|rel|target|as|query|path)=("[^"]*"|\{`[^`]*`\}|\{'[^']*'\})/g, '');
  const out = [];
  const lit = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = lit.exec(s)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  const jsxText = />([^<>{}]+)(?=[<{])/g;
  while ((m = jsxText.exec(s)) !== null) out.push(m[1]);
  return out.map((t) => t.replace(/\s+/g, ' ').trim()).filter(isCopy);
}

// Copy, not a class list or identifier: starts with a capital and has a space, or has two
// or more plain words. "font-sans text-[15px]" and "contents" are not copy; "Become a
// sponsor" is.
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
