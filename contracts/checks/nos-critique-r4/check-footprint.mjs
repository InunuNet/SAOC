// nos-critique-r4 F1 — footprint guard. Every path changed since 07e09ef3 (committed, staged,
// unstaged or untracked) must be the FAQ route, ShowFaqList.tsx, docs/nos-critique-r4.md or this
// mission's checks. The hub, tickets, vendors CTA, ShowContentState, nos-theme, NosSkipLink, Header,
// Footer and globals.css stay untouched, as does the show barrel (no new component file is needed).
//
// Run as: node contracts/checks/nos-critique-r4/check-footprint.mjs
import { execFileSync } from 'node:child_process';

import { BASE, DOC, LIST, PAGE, finish, gitRoot } from './_lib.mjs';

const NAME = 'check-footprint.mjs';
const ALLOWED = new Set([LIST, PAGE, DOC]);
const git = (...args) => execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8' });
const changed = new Set(
  [git('diff', '--name-only', BASE), git('ls-files', '--others', '--exclude-standard')]
    .join('\n').split('\n').map((l) => l.trim()).filter(Boolean),
);
const failures = [...changed]
  .filter((p) => !ALLOWED.has(p) && !p.startsWith('contracts/checks/nos-critique-r4/'))
  .map((p) => `off-limits path changed: ${p}`);
try {
  git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim());
} catch {
  failures.push(`HEAD does not descend from ${BASE}`);
}
finish(NAME, failures, `${changed.size} changed path(s), all on the cleared list.`);
