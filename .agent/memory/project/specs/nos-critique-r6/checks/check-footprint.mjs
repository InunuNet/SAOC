// nos-critique-r6 footprint guard for the stacked contracts f1..f8. Every path changed since BASE (committed, staged,
// unstaged or untracked) must be on the explicit allowlist of a feature at or below --through=N (default 1), or be
// docs/nos-critique-r6.md. There is no blanket scope: a path nobody lists fails.
//   f1  goldens/f1-footprint.json - exactly the files the R65 reference touches (32) plus nos-structure.css
//       (lead 2026-10-17: nos-theme.css, nos-structure.css, presenters.css, NOS components and routes, VenueCard, the hub
//       page.tsx type lines as one shared edit with f5). Never app/globals.css, SAOC components, tickets/page.tsx, the ticket catalogue.
//   f2  national-show/not-found.tsx, national-show/[...slug]/page.tsx
//   f3  (plus the two launch-weekend F7 checks that pinned "(required)": amended in-branch, R82 supersession) VendorApplyForm / VendorFormField / VendorCheckboxGroupField, vendors/apply/page.tsx, nos-theme.css
//   f4  SEO + R61: JsonLd.tsx, NosBreadcrumbJsonLd.tsx, national-show/layout.tsx, faq/page.tsx, app/layout.tsx,
//       app/(marketing)/layout.tsx, ChromeFrame.tsx, nos-chrome/fonts.ts
//   f5  R80: hub page.tsx, NosHero.tsx, hero-photos.ts, nos-theme.css
//   f7  R33: plan-your-visit/page.tsx, components/show/VenueCard.tsx
//   f6, f8 (second architect): goldens/f6-footprint.json and goldens/f8-footprint.json, each a JSON array of allowed paths;
//       read when present and --through reaches that feature. Their absence means no paths are cleared for them.
// OFF-LIMITS whatever a list says (F18/F19 own them): national-show/tickets, /tickets/*, app/api, workshops and conferences
// catalogues, lib/data/show-facts.ts, globals.css, Header/Footer, ShowContentState.
// nos-theme.css hunks are policed by the per-feature static checks.
//
// Batch 2 (f7 with f6, f8, f10) is re-based onto main 3f45db11, where f1-f5 and f9 are already merged:
//   node check-footprint.mjs --base=3f45db11 --only=6,7,8,10   diffs against that commit and allows ONLY those features' lists (+ the docs file).
// Run as: node check-footprint.mjs --through=8   (NOS_CR6_ROOT selects the worktree)
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BASE, DOC, NS, finish, git, specDir } from './_lib.mjs';

const NAME = 'check-footprint.mjs';
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const BASE_REF = arg('base') ?? BASE;
const only = arg('only') ? new Set(arg('only').split(',').map(Number)) : null;
const through = Number((process.argv.find((a) => a.startsWith('--through=')) ?? '--through=1').split('=')[1]);
const fromJson = (name) => {
  const p = path.join(specDir, 'goldens', name);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
};

const BY_FEATURE = {
  1: fromJson('f1-footprint.json'),
  2: [`${NS}/not-found.tsx`, `${NS}/[...slug]/page.tsx`],
  3: ['components/vendors/VendorApplyForm.tsx', 'components/vendors/VendorFormField.tsx', 'components/vendors/VendorCheckboxGroupField.tsx', `${NS}/vendors/apply/page.tsx`, `${NS}/nos-theme.css`, 'contracts/checks/launch-weekend/f7/check-h-vendor-static.mjs', 'contracts/checks/launch-weekend/f7/check-i-vendor-runtime.mjs'],
  4: ['components/seo/JsonLd.tsx', 'components/nos/NosBreadcrumbJsonLd.tsx', `${NS}/layout.tsx`, `${NS}/faq/page.tsx`],
  5: [`${NS}/page.tsx`, 'components/nos/NosHero.tsx', 'components/nos/hero-photos.ts', `${NS}/nos-theme.css`],
  6: fromJson('f6-footprint.json'),
  7: [`${NS}/plan-your-visit/page.tsx`, 'components/show/VenueCard.tsx'],
  8: fromJson('f8-footprint.json'),
  9: ['components/nos-chrome/NosHeader.tsx', 'components/nos-chrome/nos-chrome.css', 'components/nos-chrome/NosFooter.tsx', 'components/chrome/UtilityBar.tsx', 'components/chrome/nav-config.ts', ...['contracts/checks/launch-weekend/f12/check-i-utility-bar.mjs', 'contracts/checks/launch-weekend/f12/check-h-utility-render.mts', 'contracts/checks/launch-weekend/f12/check-a-static.mjs', 'contracts/checks/launch-weekend/f11/check-f11.mjs', 'contracts/checks/launch-weekend/f11/nos-menu-baseline.json', '.agent/memory/project/specs/launch-weekend/goldens/f17/nav-labels.json', 'contracts/checks/launch-weekend/f17/check-c-nav-labels.mjs', 'e2e/mega-menu-layout4-visual-fidelity.spec.ts', 'e2e/mega-menu-f8-logo-and-tickets-rail.spec.ts', 'contracts/checks/nos-own-brand-chrome/check-l-hub-h1.mjs', 'contracts/checks/nos-own-brand-chrome/f3/check-f3-audit.mjs'],],
  10: fromJson('f10-footprint.json'),
  11: fromJson('batch2-carry-footprint.json'), // post-merge follow-ups riding in the batch-2 branch (f9 UtilityBar Codex P3); cleared only with --only
};
const OFF_LIMITS = [
  `${NS}/tickets/`, 'app/(marketing)/tickets/', 'app/api/', `${NS}/workshops/`, `${NS}/conferences/`,
  'lib/data/show-facts.ts', 'lib/data/show-page-presentation.ts', 'app/globals.css', 'components/chrome/Header', 'components/chrome/Footer',
  'components/nos-chrome/NosSkipLink', 'components/nos-chrome/NosHeader', 'components/nos-chrome/NosFooter', 'components/show/nos/ShowContentState.tsx',
];
const allowed = new Set([DOC]);
for (const [f, list] of Object.entries(BY_FEATURE)) if (only ? (only.has(Number(f)) || (Number(f) === 11)) : Number(f) <= through && Number(f) !== 11) for (const p of list) allowed.add(p);

const changed = new Set(
  [git('diff', '--name-only', BASE_REF), git('ls-files', '--others', '--exclude-standard')]
    .join('\n').split('\n').map((l) => l.trim()).filter(Boolean),
);
const failures = [];
for (const p of changed) {
  if (OFF_LIMITS.some((o) => p.startsWith(o)) && !allowed.has(p)) { failures.push(`off-limits path changed (F18/F19, chrome or SAOC): ${p}`); continue; }
  if (!allowed.has(p)) failures.push(`path not on the allowlist (${only ? `only f${[...only].join(',f')}` : `--through=${through}`}): ${p}`);
}
try {
  git('merge-base', '--is-ancestor', BASE_REF, git('rev-parse', 'HEAD').trim());
} catch {
  failures.push(`HEAD does not descend from ${BASE_REF}`);
}
finish(NAME, failures, `${changed.size} changed path(s), all on the explicit allowlist (${only ? `only f${[...only].join(',f')}` : `through f${through}`}, base ${BASE_REF}).`);
