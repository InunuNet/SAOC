// nos-critique-r1 F1 — footprint guard (golden §1). Every path changed since the base
// (committed, staged, unstaged or untracked) must be on the lead's cleared list. F2 owns
// components/nos/*, components/tickets/*, ShowContentState, RealEmptyListing.tsx, the hub,
// archive and exhibitors; nothing else is cleared either.
//
// Run as: node contracts/checks/nos-critique-r1/check-footprint.mjs
import { execFileSync } from 'node:child_process';

import { BASE, finish, gitRoot } from './_lib.mjs';

const NAME = 'check-footprint.mjs';
const NS = 'app/(marketing)/national-show';
const ALLOWED = new Set([
  `${NS}/sponsors/page.tsx`,
  `${NS}/symposium/page.tsx`,
  `${NS}/wosa-conference/page.tsx`,
  `${NS}/presenters.css`,
  // QA input superseded by Codi's 2026-10-16 R9 ruling (written by @architect, not @dev).
  'contracts/checks/nos-presenter-cards/check-styles.mjs',
  // @docs output for this feature.
  'docs/nos-critique-r1.md',
]);
const ALLOWED_PREFIX = ['contracts/checks/nos-critique-r1/'];

const git = (...args) => execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8' });
const changed = new Set(
  [git('diff', '--name-only', BASE), git('ls-files', '--others', '--exclude-standard')]
    .join('\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean),
);
const failures = [...changed]
  .filter((p) => !ALLOWED.has(p) && !ALLOWED_PREFIX.some((pre) => p.startsWith(pre)))
  .map((p) => `off-limits path changed: ${p}`);
const head = git('rev-parse', 'HEAD').trim();
try {
  git('merge-base', '--is-ancestor', BASE, head);
} catch {
  failures.push(`HEAD ${head} does not descend from ${BASE}`);
}

finish(NAME, failures, `${changed.size} changed path(s), all on the cleared list.`);
