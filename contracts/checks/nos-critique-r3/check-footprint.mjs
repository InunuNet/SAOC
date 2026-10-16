// nos-critique-r3 F1 — footprint guard (golden spec §1). Every path changed since ea9056ad
// (committed, staged, unstaged or untracked) must be PresenterGrid.tsx, PresenterSection.tsx,
// presenters.css, the architect-owned pinned checks, this feature's checks, docs/nos-critique-r3.md,
// and (F2) the listed class-only component/page edits. The vendors CTA, ShowContentState, nos-theme.css,
// NosSkipLink, wosa-conference and the ticketing components stay untouched.
//
// Run as: node contracts/checks/nos-critique-r3/check-footprint.mjs
import { execFileSync } from 'node:child_process';

import { BASE, CSS, GRID, SECTION, finish, gitRoot } from './_lib.mjs';

const NAME = 'check-footprint.mjs';
// Per-feature guard, cumulative: `--through N` allows the paths of features F1..FN (default: all).
// F1 R39 presenter cards; F2 R43 body floor + order-note chip; F3 R44 A5 jump link + 2-up grid; F4 R36 .pc-title.
const through = Number((process.argv.find((a) => a.startsWith('--through=')) ?? '--through=4').split('=')[1]);
const F1 = [GRID, SECTION, CSS, 'contracts/checks/nos-presenter-cards/check-styles.mjs', 'contracts/checks/nos-presenter-cards/check-section-source.mjs', 'docs/nos-critique-r3.md',
  'contracts/checks/nos-audit-fixes/check-key-dates-stack.mjs', 'contracts/checks/nos-audit-fixes/check-sponsor-enquiry.mjs']; // architect-owned pins R43 supersedes
const F2 = [
  'components/home/NavCards.tsx', 'components/home/PartnersSection.tsx', 'components/nos/VisitorLinkCard.tsx',
  'components/nos/JudgingGroupCard.tsx', 'components/nos/ExhibitorStageCard.tsx', 'components/show/VenueCard.tsx',
  'components/show/ExhibitorKeyDates.tsx', 'components/show/ExhibitorQuestions.tsx', 'components/show/ShowFaqList.tsx',
  'components/show/nos/RealEmptyListing.tsx',
  'app/(marketing)/national-show/page.tsx', // hub: two class edits (586, 614)
  'app/(marketing)/national-show/tickets/page.tsx', // two class edits (188, 199)
  'app/(marketing)/national-show/plan-your-visit/page.tsx', 'app/(marketing)/national-show/what-to-expect/page.tsx',
];
const F3 = [
  'app/(marketing)/national-show/symposium/page.tsx',
  'components/show/nos/ShowContentState.tsx', // lead-cleared exception: the optional afterHero slot only (check-static-f3 asserts the diff is exactly that)
];
const F4 = [];
const ALLOWED = new Set([
  ...[F1, F2, F3, F4].slice(0, through).flat(),
]);
const git = (...args) => execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8' });
const changed = new Set(
  [git('diff', '--name-only', BASE), git('ls-files', '--others', '--exclude-standard')]
    .join('\n').split('\n').map((l) => l.trim()).filter(Boolean),
);
const failures = [...changed]
  .filter((p) => !ALLOWED.has(p) && !p.startsWith('contracts/checks/nos-critique-r3/'))
  .map((p) => `off-limits path changed: ${p}`);
try {
  git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim());
} catch {
  failures.push(`HEAD does not descend from ${BASE}`);
}
finish(NAME, failures, `${changed.size} changed path(s), all on the cleared list.`);
