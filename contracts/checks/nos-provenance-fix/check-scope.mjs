#!/usr/bin/env node
// nos-provenance-fix F3 — scope guard: copying and repointing only, nothing authored.
//
// Usage: node contracts/checks/nos-provenance-fix/check-scope.mjs <worktree> <baseRef>
//
//  - Every changed or new path is on the allowlist below.
//  - content/show-pages/{02,03,04}*.json differ from base ONLY in the target section's sourcePath.
//  - scripts/seed-show-pages.ts is additions-only (normal seed behaviour cannot have changed).
//  - scripts/checks/verify-show-page-m1.ts removes exactly the five pinned lines, nothing else.
//  - lib/data/show-pages.ts (the gate) is untouched.
// Exit 0 = pass, 1 = fail, 2 = could not run.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RECOVERED } from './recovered-entries.mjs';

const [wtArg, base] = process.argv.slice(2);
if (!wtArg || !base) { console.error('usage: check-scope.mjs <worktree> <baseRef>'); process.exit(2); }
const wt = path.resolve(wtArg);
const git = (...a) => execFileSync('git', ['-C', wt, ...a], { encoding: 'utf8' });

const changed = [
  ...git('diff', '--name-only', base, '--').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter(Boolean);

const ALLOWED_EXACT = new Set([
  'scripts/seed-show-pages.ts',
  'scripts/checks/verify-show-page-m1.ts',
  'docs/nos-provenance-fix.md',
  'README.md',
  ...RECOVERED.flatMap((e) => [`${e.dir}/content.md`, `${e.dir}/recovery.json`, `content/show-pages/${e.pageKey}.json`]),
]);
const ALLOWED_PREFIX = ['contracts/checks/nos-provenance-fix/'];
const failures = [];
for (const f of changed) if (!ALLOWED_EXACT.has(f) && !ALLOWED_PREFIX.some((p) => f.startsWith(p))) failures.push(`out of scope: ${f}`);

// Seeds: only the target sourcePath may differ.
for (const e of RECOVERED) {
  const file = `content/show-pages/${e.pageKey}.json`;
  const was = JSON.parse(git('show', `${base}:${file}`));
  const now = JSON.parse(readFileSync(path.join(wt, file), 'utf8'));
  const sec = was.sections.find((s) => s.sectionKey === e.sectionKey);
  if (!sec || sec.sourcePath !== e.from) { failures.push(`${file}: base does not hold the pinned from-path`); continue; }
  sec.sourcePath = `${e.dir}/content.md`;
  if (JSON.stringify(was) !== JSON.stringify(now)) failures.push(`${file}: differs from base beyond the one sourcePath`);
}

// Seed script: additions only.
const seedNumstat = git('diff', '--numstat', base, '--', 'scripts/seed-show-pages.ts').trim();
if (seedNumstat) {
  const deleted = Number(seedNumstat.split('\t')[1]);
  if (deleted !== 0) failures.push(`scripts/seed-show-pages.ts: ${deleted} line(s) deleted or changed — additions only`);
}

// M1 verifier: exactly the five pinned removals.
const PINNED_REMOVALS = [
  "const realExistingFile = 'content/drive-source/National Show/2. About/2.1 About - 2027 National Show/v1.0/content.md';",
  "const differentRealFile = 'content/drive-source/National Show/3. What to expect/3.1 Info - What to Expect/v1.0/content.md';",
  "['clean: repo-relative path under content/drive-source/, body actually linked', true, resolveNotice({ provenance: 'council-supplied', sourcePath: realExistingFile, body: linkedBody }) === null],",
  "const RECOVERY_METHODS = ['manual-salvage-from-zip-headers', 'manual-docx-extract', 'unsafe-drive-path-workaround'];",
  "check('D1', d1ok, 'all 4 content.md + recovery.json pairs exist', d1ok ? 'all present' : 'one or more missing');",
].sort();
const removed = git('diff', '-U0', base, '--', 'scripts/checks/verify-show-page-m1.ts')
  .split('\n')
  .filter((l) => l.startsWith('-') && !l.startsWith('---'))
  .map((l) => l.slice(1).trim())
  .sort();
if (removed.length && JSON.stringify(removed) !== JSON.stringify(PINNED_REMOVALS)) failures.push('scripts/checks/verify-show-page-m1.ts: removed lines are not exactly the five pinned ones');

if (git('diff', '--name-only', base, '--', 'lib/data/show-pages.ts').trim()) failures.push('lib/data/show-pages.ts changed — the gate is out of scope');

console.log(`changed vs ${base}: ${changed.length} path(s)`);
if (failures.length) { failures.forEach((f) => console.log(`FAIL ${f}`)); process.exit(1); }
console.log('PASS: copy-and-repoint scope only');
