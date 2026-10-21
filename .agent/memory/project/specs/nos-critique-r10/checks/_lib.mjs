// Shared helpers for the nos-critique-r10 checks (QA inputs written by @architect; @dev must not edit them, goldens/checks.sha256 locks them).
// The checks live with the spec, not in the worktree. They run against the worktree named by NOS_CR10_ROOT
// (default .tmp/sandbox/critique-r10). BASE is main d05c85a5 (r8 and r9 merged).
//   NOS_CR10_ROOT   worktree to inspect
//   NOS_CR10_GIT    worktree whose git history supplies the BASE file contents (default: NOS_CR10_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = 'd05c85a5';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const repoRoot = path.resolve(projectRoot, process.env.NOS_CR10_ROOT ?? '.tmp/sandbox/critique-r10');
export const gitRoot = path.resolve(projectRoot, process.env.NOS_CR10_GIT ?? process.env.NOS_CR10_ROOT ?? '.tmp/sandbox/critique-r10');

export const NS = 'app/(marketing)/national-show';
export const DOC = 'docs/nos-critique-r10.md';

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

/** Footprint guard against BASE for the whole r10 branch (the gate runs at the tip, where the diff is cumulative): only f1..f2's paths and the docs file may differ. */
export function footprintFailures() {
  const failures = [];
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const allowed = new Set([DOC, ...[1, 2].flatMap((n) => JSON.parse(golden(`f${n}-footprint.json`)))]);
  const changed = new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
  for (const p of changed) if (!allowed.has(p)) failures.push(`path not on the r10 allowlist (f1..f2): ${p}`);
  try {
    git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim());
  } catch {
    failures.push(`HEAD does not descend from ${BASE}`);
  }
  return { failures, count: changed.size, allowed };
}

export function finish(name, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${name}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
