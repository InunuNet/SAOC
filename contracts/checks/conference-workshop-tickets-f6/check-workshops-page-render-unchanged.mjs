// F6 (conference-workshop-tickets, M4) — A35 (added 2026-10-07, team-lead's post-commit
// gate sweep): the workshops page gains an additive-only loader-wiring diff, same proof
// as A9 (symposium) / A10 (wosa-conference), via the shared helper in
// ./_render-unchanged.mjs (now base-pinned to 138cbe62 instead of 'HEAD' — same fix).
//
// GAP THIS CLOSES: A11's own command (`git diff --quiet HEAD -- components/show/
// CategoryTicketsPage.tsx`) only proves the SIBLING-OWNED component is byte-unchanged —
// it never diffs workshops/page.tsx itself, so nothing previously verified that THIS
// page's own loader-wiring diff is purely additive (no removed/changed lines) the way
// A9/A10 do for their own pages. A11's description was broader than its command; A11's
// description is corrected in contract-f6.yaml to state its real, narrower scope, and
// this assertion covers the gap that correction leaves open.
import { checkAdditiveLoaderWiring } from './_render-unchanged.mjs';
import { finish } from './_lib.mjs';

const REL_PATH = 'app/(marketing)/national-show/workshops/page.tsx';

const failures = checkAdditiveLoaderWiring({
  relPath: REL_PATH,
  loaderImportPattern: /import\s*\{[^}]*\bloadWorkshopSessionViewModels\b[^}]*\}\s*from/,
  loaderCallPattern: /\bloadWorkshopSessionViewModels\s*\(/,
});

finish(
  'check-workshops-page-render-unchanged.mjs',
  failures,
  `${REL_PATH} gains an additive loadWorkshopSessionViewModels() call with zero removed/changed lines — the existing render tree (including the untouched CategoryTicketsPage usage A11 separately pins) is provably byte-for-byte unchanged.`,
);
