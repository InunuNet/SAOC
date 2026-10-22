// Shared helpers for the nos-hero-banding-2 (rHB2) checks (QA inputs written by @architect; @dev must not edit them, goldens/checks.sha256
// locks them). Adapted from the rHB spec's _lib.mjs. They inspect the checkout named by NOS_HB2_ROOT; by default the .tmp/sandbox/hb2
// worktree when it exists under the checkout holding this spec, otherwise that checkout itself.
// BASE is origin/main c6702259 (rPL, #34): the pull Brad reported banding on.
//   NOS_HB2_ROOT   checkout to inspect (relative to the cwd)
//   NOS_HB2_GIT    checkout whose git history supplies the BASE file contents (default: NOS_HB2_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = 'c6702259';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const checksDir = here;
const WORKTREE = '.tmp/sandbox/hb2';
const defaultRoot = existsSync(path.join(projectRoot, WORKTREE, 'package.json')) ? path.join(projectRoot, WORKTREE) : projectRoot;
export const repoRoot = process.env.NOS_HB2_ROOT ? path.resolve(process.env.NOS_HB2_ROOT) : defaultRoot;
export const gitRoot = process.env.NOS_HB2_GIT ? path.resolve(process.env.NOS_HB2_GIT) : repoRoot;

export const DOC = 'docs/nos-hero-banding.md';
export const SPEC_PREFIX = '.agent/memory/project/specs/nos-hero-banding-2/';
// Paths whose change cannot affect a build (the server's freshness test skips them): the whole .agent tree and the docs.
export const NOT_BUILT = ['.agent/', 'docs/'];
export const FOOTPRINT = ['app/globals.css', DOC];

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

/** Paths changed against BASE (committed, staged, unstaged and untracked), excluding nothing. */
export function changedPaths() {
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  return new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
}

/** Footprint guard against BASE: only app/globals.css, the docs file and this spec directory may differ. */
export function footprintFailures() {
  const failures = [];
  const changed = changedPaths();
  for (const p of changed) if (!FOOTPRINT.includes(p) && !p.startsWith(SPEC_PREFIX)) failures.push(`path outside the rHB2 footprint (${FOOTPRINT.join(', ')}, the spec dir): ${p}`);
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
