// Shared helpers for the nos-critique-r20 checks (QA inputs written by @architect; @dev must not edit them, goldens/checks-fN.sha256 lock them).
// The checks are committed on fix/nos-critique-r20 with the spec. They inspect the checkout named by NOS_CR20_ROOT; by default the
// .tmp/sandbox/critique-r20 worktree when it exists under the checkout holding this spec, otherwise that checkout itself.
// BASE is origin/main 7fb251a1 (r18 and r19 merged; re-pinned from a4807791 when r19 (7fb251a1) merged in between). Neither touches
// components/nos-chrome/, so the footer Codi reviewed is unchanged; r19's nos-structure.css rule sits at line 2028, far below F2's line 570.
//   NOS_CR20_ROOT   checkout to inspect (relative to the cwd)
//   NOS_CR20_GIT    checkout whose git history supplies the BASE file contents (default: NOS_CR20_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '7fb251a1';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
const WORKTREE = '.tmp/sandbox/critique-r20';
const defaultRoot = existsSync(path.join(projectRoot, WORKTREE, 'package.json')) ? path.join(projectRoot, WORKTREE) : projectRoot;
export const repoRoot = process.env.NOS_CR20_ROOT ? path.resolve(process.env.NOS_CR20_ROOT) : defaultRoot;
export const gitRoot = process.env.NOS_CR20_GIT ? path.resolve(process.env.NOS_CR20_GIT) : repoRoot;

export const DOC = 'docs/nos-critique-r20.md';
export const SPEC_PREFIX = '.agent/memory/project/specs/nos-critique-r20/';
const FOOTPRINTS = ['f1-footprint.json', 'f2-footprint.json', 'f3-footprint.json', 'f4-footprint.json'];

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

/** Footprint guard against BASE for the whole r20 branch: only the goldens/fN-footprint.json paths, the docs file and this spec directory may differ. */
export function footprintFailures() {
  const failures = [];
  const allowed = new Set([DOC, ...FOOTPRINTS.flatMap((f) => goldenJson(f))]);
  const changed = changedPaths();
  for (const p of changed) if (!allowed.has(p) && !p.startsWith(SPEC_PREFIX)) failures.push(`path not on the r20 allowlist (${FOOTPRINTS.map((f) => `goldens/${f}`).join(', ')}, the docs file, the spec dir): ${p}`);
  try {
    git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim());
  } catch {
    failures.push(`HEAD does not descend from ${BASE}`);
  }
  return { failures, count: changed.size };
}

/** Lines of `head` not matched, in order, against the BASE lines (BASE lines must all survive, in order, except `dropped`). */
export function additions(head, base, dropped = []) {
  const h = head.split('\n');
  const added = [];
  const missing = [];
  let i = 0;
  for (const line of base.split('\n')) {
    if (dropped.includes(line)) continue;
    let j = i;
    while (j < h.length && h[j] !== line) j++;
    if (j === h.length) { missing.push(line); continue; }
    added.push(...h.slice(i, j));
    i = j + 1;
  }
  added.push(...h.slice(i));
  return { added, missing };
}

export function finish(name, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${name}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
