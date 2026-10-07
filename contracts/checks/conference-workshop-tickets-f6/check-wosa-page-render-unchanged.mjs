// F6 (conference-workshop-tickets, M4) — A10: the wosa-conference page gains the same
// kind of additive loader call with the same unchanged-render guarantee as the symposium
// page (A9) — either loadPresenterViewModels('wosa-conference') or
// loadTicketCardViewModel('wosa-conference') (or both), via the same additive-only-diff
// proof in ./_render-unchanged.mjs.
//
// SAOC is not wild orchid conservation (see CLAUDE.md) — this page is still SAOC's own
// WOSA-conference EVENT listing (a co-hosted session at the National Show), not wild-orchid
// content; this check only touches the loader-wiring diff, same as A9.
import { checkAdditiveLoaderWiring } from './_render-unchanged.mjs';
import { finish } from './_lib.mjs';

const REL_PATH = 'app/(marketing)/national-show/wosa-conference/page.tsx';

const failures = checkAdditiveLoaderWiring({
  relPath: REL_PATH,
  loaderImportPattern: /import\s*\{[^}]*\b(loadPresenterViewModels|loadTicketCardViewModel)\b[^}]*\}\s*from/,
  loaderCallPattern: /\b(loadPresenterViewModels|loadTicketCardViewModel)\s*\(/,
});

finish(
  'check-wosa-page-render-unchanged.mjs',
  failures,
  `${REL_PATH} gains an additive loader call with zero removed/changed lines — the existing render tree is provably byte-for-byte unchanged.`,
);
