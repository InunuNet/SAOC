// Shared helpers for the nos-critique-r14 checks (QA inputs written by @architect; @dev must not edit them, goldens/checks-f1.sha256 locks them).
// The checks are committed on fix/nos-critique-r14 with the spec. They inspect the checkout named by NOS_CR14_ROOT; by default the
// .tmp/sandbox/critique-r14 worktree when it exists under the checkout holding this spec, otherwise that checkout itself.
// BASE is main 9d16cf96 (r13 merged).
//   NOS_CR14_ROOT   checkout to inspect (relative to the cwd)
//   NOS_CR14_GIT    checkout whose git history supplies the BASE file contents (default: NOS_CR14_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '9d16cf96';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const SPEC_REL = path.relative(projectRoot, specDir);
const WORKTREE = '.tmp/sandbox/critique-r14';
const defaultRoot = existsSync(path.join(projectRoot, WORKTREE, 'package.json')) ? path.join(projectRoot, WORKTREE) : projectRoot;
export const repoRoot = process.env.NOS_CR14_ROOT ? path.resolve(process.env.NOS_CR14_ROOT) : defaultRoot;
export const gitRoot = process.env.NOS_CR14_GIT ? path.resolve(process.env.NOS_CR14_GIT) : repoRoot;

export const DOC = 'docs/nos-critique-r14.md';
export const CSS = 'app/(marketing)/national-show/nos-structure.css';

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

/** Footprint guard against BASE for the whole r14 branch: only goldens/f1-footprint.json, the docs file and this spec directory may differ. */
export function footprintFailures() {
  const failures = [];
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const allowed = new Set([DOC, ...JSON.parse(golden('f1-footprint.json'))]);
  const specPrefix = '.agent/memory/project/specs/nos-critique-r14/';
  const changed = new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
  for (const p of changed) if (!allowed.has(p) && !p.startsWith(specPrefix)) failures.push(`path not on the r14 allowlist (goldens/f1-footprint.json, the spec dir): ${p}`);
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
