// Shared helpers for the nos-critique-r13 checks (QA inputs written by @architect; @dev must not edit them, goldens/checks.sha256 locks them).
// The checks live with the spec, not in the worktree. They run against the worktree named by NOS_CR13_ROOT
// (default .tmp/sandbox/critique-r13). BASE is main 5f8d2311 (r12 merged).
//   NOS_CR13_ROOT   worktree to inspect
//   NOS_CR13_GIT    worktree whose git history supplies the BASE file contents (default: NOS_CR13_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '5f8d2311';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const repoRoot = path.resolve(projectRoot, process.env.NOS_CR13_ROOT ?? '.tmp/sandbox/critique-r13');
export const gitRoot = path.resolve(projectRoot, process.env.NOS_CR13_GIT ?? process.env.NOS_CR13_ROOT ?? '.tmp/sandbox/critique-r13');

export const DOC = 'docs/nos-critique-r13.md';

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

/** Footprint guard against BASE for the whole r13 branch (the gate runs at the tip, where the diff is cumulative): only the union of every
 *  goldens/fN-footprint.json of the r13 features (each pinned by its own checks-fN.sha256) and the docs file may differ. */
export const FEATURES = [1];
export function footprintFailures() {
  const failures = [];
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const present = FEATURES.filter((n) => existsSync(path.join(specDir, 'goldens', `f${n}-footprint.json`)));
  const allowed = new Set([DOC, ...present.flatMap((n) => JSON.parse(golden(`f${n}-footprint.json`)))]);
  const changed = new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
  for (const p of changed) if (!allowed.has(p)) failures.push(`path not on the r13 allowlist (goldens/fN-footprint.json): ${p}`);
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
