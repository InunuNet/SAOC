#!/usr/bin/env node
// nos-provenance-fix F3 — the M1 show-page verifier, run on a clean clone (no drive-source).
//
// Usage: node contracts/checks/nos-provenance-fix/check-m1.mjs <worktree>
//
// Before F3 it fails S1, G1, G5, G11, P1, P3 and P4 on a clean clone. F3 must clear G1, G5,
// G11 (fixtures repointed at drive-recovered) and P4 (seeds relinked). S1, P1 and P3 are
// pre-existing staleness from national-show-ia-alignment M4 (council-draft added, four pages
// retired) and are NOT this feature's to fix — they are tolerated, nothing else is.
// Also pins that the three new recovery entries and the new method are registered.
// Exit 0 = pass, 1 = fail, 2 = could not run.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const wt = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!wt) { console.error('usage: check-m1.mjs <worktree>'); process.exit(2); }
if (existsSync(path.join(wt, 'content/drive-source'))) {
  console.error('check-m1: content/drive-source/ exists in the worktree — not a clean clone');
  process.exit(2);
}
const TOLERATED = new Set(['S1', 'P1', 'P3']);

const run = spawnSync('pnpm', ['exec', 'tsx', 'scripts/checks/verify-show-page-m1.ts'], { cwd: wt, encoding: 'utf8' });
const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
if (/Verifier bug/.test(out) || !/^(FAIL|SKIP) /m.test(out)) {
  console.error('check-m1: verifier did not run cleanly');
  console.error(out.slice(0, 2000));
  process.exit(2);
}
const fails = [...out.matchAll(/^FAIL ([A-Z]\d+[a-z]?)/gm)].map((m) => m[1]);
const unexpected = fails.filter((id) => !TOLERATED.has(id));

const src = readFileSync(path.join(wt, 'scripts/checks/verify-show-page-m1.ts'), 'utf8');
const PINNED = [
  "{ dir: '02-about-the-national-show/about', specPage: 2 }",
  "{ dir: '03-what-to-expect/what-to-expect', specPage: 3 }",
  "{ dir: '04-south-african-exhibitors/sa-exhibitors', specPage: 4 }",
  "'drive-source-verbatim-extract'",
  "const realExistingFile = 'content/drive-recovered/02-about-the-national-show/about/content.md';",
  "const differentRealFile = 'content/drive-recovered/03-what-to-expect/what-to-expect/content.md';",
  'all ${RECOVERY_ENTRIES.length} content.md + recovery.json pairs exist',
];
const missing = PINNED.filter((p) => !src.includes(p));

console.log(`verify-show-page-m1 FAIL ids: ${fails.join(', ') || '(none)'}; tolerated: ${[...TOLERATED].join(', ')}`);
if (unexpected.length) console.log(`FAIL unexpected verifier failures: ${unexpected.join(', ')}`);
if (missing.length) missing.forEach((m) => console.log(`FAIL verifier source lacks: ${m}`));
process.exit(unexpected.length || missing.length ? 1 : 0);
