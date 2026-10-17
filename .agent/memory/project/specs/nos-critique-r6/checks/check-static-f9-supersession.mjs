// nos-critique-r6 F9 - supersession check (lead 2026-10-17). Every old check/golden/spec that pinned the NOS utility bar, the old nav-config strings or the old rail hrefs
// has an entry in goldens/supersession.json (path, BASE line ranges, reason, citation of "v4 decision #2", "Brad naming ruling" or "R68"); each listed file really changed
// (the pin was amended); and no changed line in those files, nor any other changed contracts/checks, e2e or launch-weekend golden file, lies outside the listed ranges.
// Run as: node check-static-f9-supersession.mjs   (NOS_CR6_ROOT selects the worktree)
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { BASE, finish, git, specDir } from './_lib.mjs';

const NAME = 'check-static-f9-supersession.mjs';
const failures = [];
const fail = (m) => failures.push(m);
const sup = JSON.parse(readFileSync(path.join(specDir, 'goldens', 'supersession.json'), 'utf8'));
const WATCH = ['contracts/checks', 'e2e', '.agent/memory/project/specs/launch-weekend/goldens'];
const OURS = new Set(sup.entries.map((e) => e.path));
const F3_OWNED = new Set(['contracts/checks/launch-weekend/f7/check-h-vendor-static.mjs', 'contracts/checks/launch-weekend/f7/check-i-vendor-runtime.mjs']); // R82, f3's own supersession

for (const e of sup.entries) {
  if (!e.reason || e.reason.length < 20) fail(`${e.path}: needs a reason`);
  if (!/v4 decision #2|Brad naming ruling|R68/.test(e.cite ?? '')) fail(`${e.path}: cite must be "v4 decision #2", "Brad naming ruling" or "R68"`);
  if (!Array.isArray(e.lines) || e.lines.length === 0) fail(`${e.path}: needs line ranges`);
}

// changed files (committed since BASE, staged, unstaged, untracked) under the watched trees
const changed = new Set([
  ...git('diff', '--name-only', BASE, '--', ...WATCH).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard', '--', ...WATCH).split('\n'),
].filter(Boolean));
for (const f of changed) if (!OURS.has(f) && !F3_OWNED.has(f) && !f.startsWith('contracts/checks/nos-critique-r6')) fail(`${f}: changed but has no entry in goldens/supersession.json`);
for (const e of sup.entries) {
  if (!changed.has(e.path)) { fail(`${e.path}: listed as superseded but unchanged since ${BASE}; its old pin is still in place`); continue; }
  const diff = git('diff', '-U0', BASE, '--', e.path);
  for (const m of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    const from = count === 0 ? start : start;
    const to = count === 0 ? start : start + count - 1;
    const ok = e.lines.some(([a, b]) => (count === 0 ? start >= a - 1 && start <= b : from >= a && to <= b));
    if (!ok) fail(`${e.path}: changed lines ${from}-${to} (BASE numbering) are outside the superseded ranges ${JSON.stringify(e.lines)}`);
  }
}
finish(NAME, failures, `supersession: ${sup.entries.length} files amended, every change inside its listed lines, no other check/e2e/golden file touched.`);
