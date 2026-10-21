// Shared helpers for the nos-critique-r7 checks (QA inputs written by @architect; @dev must not edit them, goldens/checks.sha256 locks them).
// The checks live with the spec, not in the worktree. They run against the worktree named by NOS_CR7_ROOT
// (default .tmp/sandbox/critique-r7). BASE is main 1f8ad3de (r6 merged).
//   NOS_CR7_ROOT   worktree to inspect
//   NOS_CR7_GIT    worktree whose git history supplies the BASE file contents (default: NOS_CR7_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '1f8ad3de';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const repoRoot = path.resolve(projectRoot, process.env.NOS_CR7_ROOT ?? '.tmp/sandbox/critique-r7');
export const gitRoot = path.resolve(projectRoot, process.env.NOS_CR7_GIT ?? process.env.NOS_CR7_ROOT ?? '.tmp/sandbox/critique-r7');

export const NS = 'app/(marketing)/national-show';
export const DOC = 'docs/nos-critique-r7.md';

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

export const golden = (name) => readFileSync(path.join(specDir, 'goldens', name), 'utf8');

/** Source with comments removed. One pass, so a `/*` inside a line comment or a string never opens a block comment. */
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
  return out.map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => / /.test(t) && !/[;()]/.test(t) && (/^[A-Z]/.test(t) || t.split(' ').filter((w) => /^[A-Za-z][a-z’']*[.,;:!?]?$/.test(w)).length >= 3));
}

export function finish(name, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${name}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
