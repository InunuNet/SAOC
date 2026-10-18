// Shared helpers for the nos-critique-r15 F2b checks (QA input written by @architect; @dev must not edit them, goldens/checks-f2b.sha256
// locks them). F2b stacks on the r15 tip, so its BASE is 4a662f8c (the r15 tip after the restack onto main 0fdffebb; was 7bb4064b), not r15's main BASE; _lib.mjs (pinned by r15
// F1-F3) is left untouched and only _server.mjs / _color.mjs are reused. The checks inspect the checkout named by NOS_CR15F2B_ROOT; by
// default the .tmp/sandbox/critique-r15-f2b worktree when it exists under the checkout holding this spec, otherwise that checkout itself.
// Importing this module points NOS_CR15_ROOT / NOS_CR15_GIT at the same checkout, so a later dynamic import of _server.mjs builds and serves
// it (import _server.mjs only after this module has run).
//   NOS_CR15F2B_ROOT   checkout to inspect (relative to the cwd)
//   NOS_CR15F2B_GIT    checkout whose git history supplies the BASE file contents (default: NOS_CR15F2B_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '4a662f8c';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
const WORKTREE = '.tmp/sandbox/critique-r15-f2b';
const defaultRoot = existsSync(path.join(projectRoot, WORKTREE, 'package.json')) ? path.join(projectRoot, WORKTREE) : projectRoot;
export const repoRoot = process.env.NOS_CR15F2B_ROOT ? path.resolve(process.env.NOS_CR15F2B_ROOT) : defaultRoot;
export const gitRoot = process.env.NOS_CR15F2B_GIT ? path.resolve(process.env.NOS_CR15F2B_GIT) : repoRoot;
process.env.NOS_CR15_ROOT = repoRoot;
process.env.NOS_CR15_GIT = gitRoot;

export const DOC = 'docs/nos-critique-r15.md';
export const SPEC_PREFIX = '.agent/memory/project/specs/nos-critique-r15/';

export function readRepoFile(rel) {
  const abs = path.join(repoRoot, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

export function readBaseFile(rel) {
  try {
    return execFileSync('git', ['-C', gitRoot, 'show', `${BASE}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null; // new file since BASE
  }
}

export function git(...args) {
  return execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export const golden = (name) => readFileSync(path.join(specDir, 'goldens', name), 'utf8');
export const goldenJson = (name) => JSON.parse(golden(name));

/** Paths changed against BASE (committed, staged, unstaged and untracked). */
export function changedPaths() {
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  return new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
}

/** The quoted class literal on a source line that carries the ring colour (either token), with the colour normalised to `RING`. */
export function ringLiteral(line, from, to) {
  const m = line.match(/['"]([^'"]*ring-(?:ink\/40|primary)[^'"]*)['"]/);
  return m ? m[1].replace(from, 'RING').replace(to, 'RING') : null;
}

export function finish(name, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${name}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
