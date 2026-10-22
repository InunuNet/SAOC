// Shared helpers for the nos-faq-r57 (r57) checks (QA inputs written by @architect; @dev must not edit them, goldens/checks.sha256
// locks them). They inspect the checkout named by NOS_FAQ_ROOT; by default the .tmp/sandbox/r57 worktree when it exists under the
// checkout holding this spec, otherwise that checkout itself.
// BASE is the merge-base of HEAD and origin/main (see below); the branch was cut from origin/main 8e686f06.
//   NOS_FAQ_ROOT   checkout to inspect (relative to the cwd)
//   NOS_FAQ_GIT    checkout whose git history supplies the BASE file contents (default: NOS_FAQ_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const checksDir = here;
const WORKTREE = '.tmp/sandbox/r57';
const defaultRoot = existsSync(path.join(projectRoot, WORKTREE, 'package.json')) ? path.join(projectRoot, WORKTREE) : projectRoot;
export const repoRoot = process.env.NOS_FAQ_ROOT ? path.resolve(process.env.NOS_FAQ_ROOT) : defaultRoot;
export const gitRoot = process.env.NOS_FAQ_GIT ? path.resolve(process.env.NOS_FAQ_GIT) : repoRoot;

// ORIGIN is the commit this branch was cut from (origin/main 8e686f06): HEAD must always descend from it. BASE is what the diffs are
// scoped to: the merge-base of HEAD and origin/main, so a rebase onto a newer main (other PRs' files and globals.css changes) is not
// counted as this branch's change. It falls back to ORIGIN when origin/main cannot be resolved.
export const ORIGIN = '8e686f06';
function resolveBase() {
  try {
    return execFileSync('git', ['-C', gitRoot, 'merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || ORIGIN;
  } catch {
    return ORIGIN;
  }
}
export const BASE = resolveBase();

export const DOC = 'docs/nos-faq-r57.md';
export const SPEC_PREFIX = '.agent/memory/project/specs/nos-faq-r57/';

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
  for (const p of changed) if (!allowed.has(p) && !p.startsWith(SPEC_PREFIX)) failures.push(`path not on the r57 allowlist (goldens/footprint.json, the docs file, the spec dir): ${p}`);
  try {
    git('merge-base', '--is-ancestor', ORIGIN, git('rev-parse', 'HEAD').trim());
  } catch {
    failures.push(`HEAD does not descend from ${ORIGIN}`);
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
