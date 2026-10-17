// Shared helpers for the nos-critique-r6 checks (QA inputs, written by @architect; @dev must not
// edit them — goldens/checks.sha256 locks them). The checks live with the spec, not in the worktree,
// so they survive worktree rebuilds; they run against the worktree named by NOS_CR6_ROOT
// (default .tmp/sandbox/critique-r6).
//
//   NOS_CR6_ROOT   worktree to inspect (default .tmp/sandbox/critique-r6)
//   NOS_CR6_GIT    worktree whose git history supplies the BASE file contents (default: NOS_CR6_ROOT);
//                  set it to run a static check against a fixture copy (mutation proof)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pinned 2026-10-17 to main 47cf7f1b (F18a landed on top of 76ad8b98: F3, F12, F16, F17); f1-f5 share this BASE.
export const BASE = '47cf7f1b';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const repoRoot = path.resolve(projectRoot, process.env.NOS_CR6_ROOT ?? '.tmp/sandbox/critique-r6');
export const gitRoot = path.resolve(projectRoot, process.env.NOS_CR6_GIT ?? process.env.NOS_CR6_ROOT ?? '.tmp/sandbox/critique-r6');

export const NS = 'app/(marketing)/national-show';
export const NOS_THEME = `${NS}/nos-theme.css`;
export const PRESENTERS = `${NS}/presenters.css`;
export const DOC = 'docs/nos-critique-r6.md';

// Never touched by R65 (lead-ruled): the SAOC chrome and pages, the hub, tickets, the vendor forms.
const EXCLUDED_PREFIXES = [
  `${NS}/tickets/`, `${NS}/vendors/apply/`, `${NS}/vendors/register/`, `${NS}/vendors/payment/`, `${NS}/vendors/photos/`,
];
// The hub page.tsx joined the f1 scope on 2026-10-17 (lead: its body-type lines are f1's, as one shared edit with f5).
const EXCLUDED_FILES = new Set(['components/show/nos/ShowContentState.tsx']);
const SCOPE_DIRS = ['components/show/', 'components/nos/', `${NS}/`];
const VENDOR_SCOPE = new Set(['components/vendors/VendorIntro.tsx', 'components/vendors/VendorGrid.tsx', 'components/vendors/VendorEmptyState.tsx']);

export function inScope(rel) {
  if (!/\.(tsx|css)$/.test(rel)) return false;
  if (EXCLUDED_FILES.has(rel) || EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) return false;
  return VENDOR_SCOPE.has(rel) || SCOPE_DIRS.some((d) => rel.startsWith(d));
}

export function walk(dirRel) {
  const abs = path.join(repoRoot, dirRel);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const name of readdirSync(abs)) {
    const rel = `${dirRel}${name}`;
    if (statSync(path.join(repoRoot, rel)).isDirectory()) out.push(...walk(`${rel}/`));
    else out.push(rel);
  }
  return out;
}

export function scopeFiles() {
  return [...SCOPE_DIRS.flatMap((d) => walk(d)), ...VENDOR_SCOPE].filter((rel) => inScope(rel) && existsSync(path.join(repoRoot, rel)));
}

export function readRepoFile(rel) {
  const abs = path.join(repoRoot, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

export function readBaseFile(rel) {
  try {
    return execFileSync('git', ['-C', gitRoot, 'show', `${BASE}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null; // new file since BASE
  }
}

export function git(...args) {
  return execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8' });
}

/** Source with comments removed. One pass, so a `/*` inside a line comment or a string (e.g. "/national-show/*") never opens a block comment. */
export function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => (str === undefined ? '' : str));
}

/** Human-readable copy: string literals and JSX text, minus imports and className/data-/href/id/key values. */
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
  return out.map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => / /.test(t) && !/[;()]/.test(t) && (/^[A-Z]/.test(t) || t.split(' ').filter((w) => /^[A-Za-z][a-z’']*[.,;:!?]?$/.test(w)).length >= 2));
}

export function finish(name, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${name}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
