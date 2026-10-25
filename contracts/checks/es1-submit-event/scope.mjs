// ES-1 scope guard. Every file changed since the base (committed, modified or untracked) must be on the
// allow-list in goldens/scope.json or under this mission's spec and check trees.
// Base: ES1_BASE (a ref), default 823e6b09.
// Run as: node contracts/checks/es1-submit-event/scope.mjs
// Self-test: node contracts/checks/es1-submit-event/scope.mjs --files "a/b.ts,c/d.ts"  (replaces the git file list)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { finish, repoRoot } from '../polish-wave-2026-10-25/_lib.mjs';

const SPEC = '.agent/memory/project/specs/es1-submit-event/';
const ALWAYS = [SPEC, 'contracts/checks/es1-submit-event/'];
const allow = JSON.parse(readFileSync(resolve(repoRoot, SPEC, 'goldens/scope.json'), 'utf8')).allow;
if (allow.length < 2) finish('scope', [`allow-list looks empty (${allow.length} entries)`]);

const git = (args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).split('\n').filter(Boolean);
let changed;
const override = process.argv.indexOf('--files');
if (override > -1) changed = process.argv[override + 1].split(',');
else {
  const base = process.env.ES1_BASE || '823e6b09';
  changed = [...new Set([...git(['diff', '--name-only', base]), ...git(['ls-files', '--others', '--exclude-standard'])])];
}
const permitted = (f) => ALWAYS.some((p) => f.startsWith(p)) || allow.some((a) => (a.endsWith('/') ? f.startsWith(a) : f === a));
finish('scope', changed.filter((f) => !permitted(f)).map((f) => `out of scope: ${f}`));
