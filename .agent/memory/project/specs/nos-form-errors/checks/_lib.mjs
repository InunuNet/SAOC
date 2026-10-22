// Shared helpers for the nos-form-errors (rFE) checks (QA inputs written by @architect; @dev must not edit them, goldens/checks.sha256
// locks them). They inspect the checkout named by NOS_FE_ROOT; by default the .tmp/sandbox/rfe worktree when it exists under the
// checkout holding this spec, otherwise that checkout itself.
// BASE is origin/main 64cf1bd2 (rFT merged).
//   NOS_FE_ROOT   checkout to inspect (relative to the cwd)
//   NOS_FE_GIT    checkout whose git history supplies the BASE file contents (default: NOS_FE_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '64cf1bd2';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const checksDir = here;
const WORKTREE = '.tmp/sandbox/rfe';
const defaultRoot = existsSync(path.join(projectRoot, WORKTREE, 'package.json')) ? path.join(projectRoot, WORKTREE) : projectRoot;
export const repoRoot = process.env.NOS_FE_ROOT ? path.resolve(process.env.NOS_FE_ROOT) : defaultRoot;
export const gitRoot = process.env.NOS_FE_GIT ? path.resolve(process.env.NOS_FE_GIT) : repoRoot;

export const DOC = 'docs/nos-form-errors.md';
export const SPEC_PREFIX = '.agent/memory/project/specs/nos-form-errors/';

export function readRepoFile(rel) {
  const abs = path.join(repoRoot, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

export function readBaseFile(rel) {
  try {
    return execFileSync('git', ['-C', gitRoot, 'show', `${BASE}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 67108864 });
  } catch {
    return null; // new file since BASE
  }
}

export function git(...args) {
  return execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8', maxBuffer: 67108864 });
}

export const golden = (name) => readFileSync(path.join(specDir, 'goldens', name), 'utf8');
export const goldenJson = (name) => JSON.parse(golden(name));

/** Paths changed against BASE (committed, staged, unstaged and untracked). */
export function changedPaths() {
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  return new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
}

/** Footprint guard against BASE: only goldens/footprint.json, the docs file and this spec directory may differ; HEAD descends from BASE. */
export function footprintFailures() {
  const failures = [];
  const allowed = new Set([DOC, ...goldenJson('footprint.json')]);
  const changed = changedPaths();
  for (const p of changed) if (!allowed.has(p) && !p.startsWith(SPEC_PREFIX)) failures.push(`path not on the rFE allowlist (goldens/footprint.json, the docs file, the spec dir): ${p}`);
  try {
    git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim());
  } catch {
    failures.push(`HEAD does not descend from ${BASE}`);
  }
  return { failures, count: changed.size };
}

export function finish(name, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${name}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
