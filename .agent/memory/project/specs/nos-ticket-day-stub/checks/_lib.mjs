// Shared helpers for the nos-ticket-day-stub (r45) checks (QA inputs written by @architect; @dev must not edit them, goldens/checks-f1.sha256
// locks them). The checks are committed on fix/nos-ticket-day-stub with the spec. They inspect the checkout named by NOS_TDS_ROOT; by default
// the .tmp/sandbox/critique-r45 worktree when it exists under the checkout holding this spec, otherwise that checkout itself.
// BASE is origin/main 1a7479f1 (r20 merged). rHB (fix/nos-hero-banding) touches only the home hero, none of the r45 footprint.
//   NOS_TDS_ROOT   checkout to inspect (relative to the cwd)
//   NOS_TDS_GIT    checkout whose git history supplies the BASE file contents (default: NOS_TDS_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '1a7479f1';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const checksDir = here;
const WORKTREE = '.tmp/sandbox/critique-r45';
const defaultRoot = existsSync(path.join(projectRoot, WORKTREE, 'package.json')) ? path.join(projectRoot, WORKTREE) : projectRoot;
export const repoRoot = process.env.NOS_TDS_ROOT ? path.resolve(process.env.NOS_TDS_ROOT) : defaultRoot;
export const gitRoot = process.env.NOS_TDS_GIT ? path.resolve(process.env.NOS_TDS_GIT) : repoRoot;

export const DOC = 'docs/nos-ticket-day-stub.md';
export const SPEC_PREFIX = '.agent/memory/project/specs/nos-ticket-day-stub/';
const FOOTPRINTS = ['f1-footprint.json'];

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

/** Footprint guard against BASE for the whole r45 branch: only the goldens/f1-footprint.json paths, the docs file and this spec directory may differ. */
export function footprintFailures() {
  const failures = [];
  const allowed = new Set([DOC, ...FOOTPRINTS.flatMap((f) => goldenJson(f))]);
  const changed = changedPaths();
  for (const p of changed) if (!allowed.has(p) && !p.startsWith(SPEC_PREFIX)) failures.push(`path not on the r45 allowlist (${FOOTPRINTS.map((f) => `goldens/${f}`).join(', ')}, the docs file, the spec dir): ${p}`);
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
