// nos-critique-r5 — footprint guard. Every path changed since ee366553 (committed, staged, unstaged
// or untracked) must be on the cleared list for the features requested. Cumulative:
//   --through=1  F1 (60ch measure): the vendors and exhibitors page files only
//   --through=2  adds F2 (R52 chips): components/show/ShowFaqList.tsx
// docs/nos-critique-r5.md and this mission's checks are always allowed. The vendors CTA, the vendors
// apply/register/payment/photos subroutes, ShowContentState, the hub, tickets, nos-theme, Header,
// Footer, globals.css and every shared component other than ShowFaqList stay untouched.
//
// Run as: node contracts/checks/nos-critique-r5/check-footprint.mjs --through=2
import { execFileSync } from 'node:child_process';

import { BASE, DOC, EXHIBITORS, LIST, VENDORS, finish, gitRoot } from './_lib.mjs';

const NAME = 'check-footprint.mjs';
const through = Number((process.argv.find((a) => a.startsWith('--through=')) ?? '--through=2').split('=')[1]);
const F1 = [VENDORS, EXHIBITORS];
const F2 = [LIST];
const ALLOWED = new Set([DOC, ...[F1, F2].slice(0, through).flat()]);
const git = (...args) => execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8' });
const changed = new Set(
  [git('diff', '--name-only', BASE), git('ls-files', '--others', '--exclude-standard')]
    .join('\n').split('\n').map((l) => l.trim()).filter(Boolean),
);
const failures = [...changed]
  .filter((p) => !ALLOWED.has(p) && !p.startsWith('contracts/checks/nos-critique-r5/'))
  .map((p) => `off-limits path changed: ${p}`);
try {
  git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim());
} catch {
  failures.push(`HEAD does not descend from ${BASE}`);
}
finish(NAME, failures, `${changed.size} changed path(s), all on the cleared list (through F${through}).`);
