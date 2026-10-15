#!/usr/bin/env node
// nos-provenance-fix F2 (H1) — scope guard.
//
// Usage: node contracts/checks/trace-excludes/check-scope.mjs <worktree> <baseRef>
//
// (a) The only tracked files changed against base are next.config.ts and lib/data/show-pages.ts
//     (plus these checks themselves, once committed).
// (b) lib/data/show-pages.ts differs from base ONLY by `/*turbopackIgnore: true*/` markers and
//     whole-line `//` comments — the provenance gate's logic is byte-identical. This is a
//     security trim, not a license to touch classifySection.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const [worktree, baseRef] = process.argv.slice(2);
if (!worktree || !baseRef) {
  console.error('usage: check-scope.mjs <worktree> <baseRef>');
  process.exit(2);
}
const root = path.resolve(worktree);
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });

const ALLOWED = new Set(['next.config.ts', 'lib/data/show-pages.ts']);
const changed = git('diff', '--name-only', baseRef, '--').split('\n').filter(Boolean);
const CHECKS_DIR = 'contracts/checks/trace-excludes/';
const outOfScope = changed.filter((f) => !ALLOWED.has(f) && !f.startsWith(CHECKS_DIR));

const SHOW_PAGES = 'lib/data/show-pages.ts';
const normalise = (src) =>
  src
    .replaceAll('/*turbopackIgnore: true*/ ', '')
    .replaceAll('/*turbopackIgnore: true*/', '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
const baseSrc = git('show', `${baseRef}:${SHOW_PAGES}`);
const nowSrc = readFileSync(path.join(root, SHOW_PAGES), 'utf8');
const logicSame = normalise(baseSrc) === normalise(nowSrc);

console.log(`changed vs ${baseRef}: ${changed.join(', ') || '(none)'}`);
if (outOfScope.length) console.log(`FAIL out-of-scope files: ${outOfScope.join(', ')}`);
if (!logicSame) console.log(`FAIL ${SHOW_PAGES}: changes beyond turbopackIgnore markers and // comments`);
process.exit(outOfScope.length || !logicSame ? 1 : 0);
