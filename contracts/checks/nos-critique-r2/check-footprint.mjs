// nos-critique-r2 F1 — footprint guard (golden §1). Every path changed since 3ce52d11
// (committed, staged, unstaged or untracked) must be one of the six cleared route files,
// this feature's checks, or its doc. ShowContentState, components/nos-chrome/*,
// national-show/layout.tsx, components/nos/*, components/tickets/* and every shared
// component (ShowFaqList, VisitorInfoBlock, RealEmptyListing, ...) stay untouched.
//
// Run as: node contracts/checks/nos-critique-r2/check-footprint.mjs
import { execFileSync } from 'node:child_process';

import { BASE, FILES, finish, gitRoot } from './_lib.mjs';

const NAME = 'check-footprint.mjs';
const ALLOWED = new Set([
  ...Object.values(FILES),
  'app/(marketing)/national-show/presenters.css', // R35 (item 4)
  'contracts/checks/nos-presenter-cards/check-styles.mjs', // architect-owned, R35 pins
  'docs/nos-critique-r2.md',
]);
const git = (...args) => execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8' });
const changed = new Set(
  [git('diff', '--name-only', BASE), git('ls-files', '--others', '--exclude-standard')]
    .join('\n').split('\n').map((l) => l.trim()).filter(Boolean),
);
const failures = [...changed]
  .filter((p) => !ALLOWED.has(p) && !p.startsWith('contracts/checks/nos-critique-r2/'))
  .map((p) => `off-limits path changed: ${p}`);
try {
  git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim());
} catch {
  failures.push(`HEAD does not descend from ${BASE}`);
}
finish(NAME, failures, `${changed.size} changed path(s), all on the cleared list.`);
