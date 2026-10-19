// Shared helpers for the nos-critique-r17 checks (QA inputs written by @architect; @dev must not edit them, goldens/checks-fN.sha256 lock them).
// The checks are committed on fix/nos-critique-r17 with the spec. They inspect the checkout named by NOS_CR17_ROOT; by default the
// .tmp/sandbox/critique-r17 worktree when it exists under the checkout holding this spec, otherwise that checkout itself.
// BASE is origin/main 39b15ec0 (F31 Ozow statuses) since the restack (was 5c093d6e, r16 merged, when the spec was written; the two
// differ only in payments/orders/notification code, the vendor payment page and launch-weekend specs, none of which r17 reads at BASE).
//   NOS_CR17_ROOT   checkout to inspect (relative to the cwd)
//   NOS_CR17_GIT    checkout whose git history supplies the BASE file contents (default: NOS_CR17_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '39b15ec0';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
const WORKTREE = '.tmp/sandbox/critique-r17';
const defaultRoot = existsSync(path.join(projectRoot, WORKTREE, 'package.json')) ? path.join(projectRoot, WORKTREE) : projectRoot;
export const repoRoot = process.env.NOS_CR17_ROOT ? path.resolve(process.env.NOS_CR17_ROOT) : defaultRoot;
export const gitRoot = process.env.NOS_CR17_GIT ? path.resolve(process.env.NOS_CR17_GIT) : repoRoot;

export const DOC = 'docs/nos-critique-r17.md';
export const SPEC_PREFIX = '.agent/memory/project/specs/nos-critique-r17/';
// F3 is specified separately (in diagnosis when F1/F2 were written); its footprint joins the union once its golden exists.
const FOOTPRINTS = ['f1-footprint.json', 'f2-footprint.json', 'f3-footprint.json'].filter((f) => existsSync(path.join(specDir, 'goldens', f)));

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

/** Paths changed against BASE (committed, staged, unstaged and untracked), excluding nothing. */
export function changedPaths() {
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  return new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
}

/** Footprint guard against BASE for the whole r17 branch: only the union of goldens/f1..f3-footprint.json (+ the F2 logo dest), the docs file and this spec
 *  directory may differ. */
export function footprintFailures() {
  const failures = [];
  // F2: the footer logo copy's destination is the golden field filled once Codi picks the file (f2-logo.json chosen.dest).
  const logoDest = goldenJson('f2-logo.json').chosen?.dest;
  const allowed = new Set([DOC, ...FOOTPRINTS.flatMap((f) => goldenJson(f)), ...(logoDest ? [logoDest] : [])]);
  const changed = changedPaths();
  for (const p of changed) if (!allowed.has(p) && !p.startsWith(SPEC_PREFIX)) failures.push(`path not on the r17 allowlist (${FOOTPRINTS.map((f) => `goldens/${f}`).join(', ')}, the docs file, the spec dir): ${p}`);
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
