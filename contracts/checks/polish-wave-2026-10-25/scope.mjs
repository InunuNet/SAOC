// Wave scope guard. Every file changed since the merge-base with origin/main (committed, modified or
// untracked) must be on some feature's allow-list in goldens/scope/*.json, or under the two always-
// allowed trees (this mission's spec dir, this check dir). A pre-existing check or golden may be
// edited only where an allow-list names it, and each such edit must be listed in checks-updated.md
// (the assertion for that lives in the contract, as a grep).
// Run as: node contracts/checks/polish-wave-2026-10-25/scope.mjs
// Self-test: node contracts/checks/polish-wave-2026-10-25/scope.mjs --files "a/b.ts,c/d.ts"  (replaces the git file list)
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { finish, repoRoot } from './_lib.mjs';

const SPEC = '.agent/memory/project/specs/polish-wave-2026-10-25/';
const ALWAYS = [SPEC, 'contracts/checks/polish-wave-2026-10-25/'];
const scopeDir = resolve(repoRoot, SPEC, 'goldens/scope');
const allow = readdirSync(scopeDir).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(resolve(scopeDir, f), 'utf8')).allow);
if (allow.length < 10) finish('scope', [`allow-lists look empty (${allow.length} entries)`]);

const git = (args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).split('\n').filter(Boolean);
let changed;
const override = process.argv.indexOf('--files');
if (override > -1) changed = process.argv[override + 1].split(',');
else {
  const base = git(['merge-base', 'HEAD', 'origin/main'])[0];
  changed = [...new Set([...git(['diff', '--name-only', base]), ...git(['ls-files', '--others', '--exclude-standard'])])];
}
const permitted = (f) => ALWAYS.some((p) => f.startsWith(p)) || allow.some((a) => (a.endsWith('/') ? f.startsWith(a) : f === a));
const out = changed.filter((f) => !permitted(f));
finish('scope', out.map((f) => `out of scope: ${f}`));
