// Shared helpers for the events-redesign checks (QA inputs written by @architect; @dev must not edit them, goldens/checks.sha256 locks them).
// They inspect the checkout holding this spec (the feat/events-redesign worktree); EV_ROOT overrides it. BASE is origin/main a20a0023.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = 'a20a0023';
const here = path.dirname(fileURLToPath(import.meta.url));
export const specDir = path.resolve(here, '..');
export const repoRoot = process.env.EV_ROOT ? path.resolve(process.env.EV_ROOT) : path.resolve(here, '../../../../../..');
export const DOC = 'docs/events-redesign.md';
export const SPEC_PREFIX = '.agent/memory/project/specs/events-redesign/';

export const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
export const golden = (name) => readFileSync(path.join(specDir, 'goldens', name), 'utf8');
export const goldenJson = (name) => JSON.parse(golden(name));
export const readRepoFile = (rel) => { const abs = path.join(repoRoot, rel); return existsSync(abs) ? readFileSync(abs, 'utf8') : null; };
export const readBaseFile = (rel) => { try { return git('show', `${BASE}:${rel}`); } catch { return null; } };

const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
/** Paths changed against BASE: committed, staged, unstaged and untracked. */
export function changedPaths() {
  return new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
}

/** Added lines (against BASE) of one path; a new file is all additions. */
export function addedLines(rel) {
  const out = git('diff', '-U0', BASE, '--', rel);
  const added = out.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  if (added.length === 0 && readBaseFile(rel) === null) return (readRepoFile(rel) ?? '').split('\n');
  return added;
}

export function finish(name, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${name}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
