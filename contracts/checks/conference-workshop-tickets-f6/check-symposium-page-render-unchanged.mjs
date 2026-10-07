// F6 (conference-workshop-tickets, M4) — A9: the symposium page gains exactly one
// additive server-side loader call; its existing rendered JSX output is byte-for-byte
// unchanged (diff touches only the data-fetch/prop-pass lines, never the return/render
// tree). Golden §3 says "the relevant loader(s) above" (plural) — this page is both a
// presenter-bearing event (saoc-symposium) and its own ticket product, so either
// loadPresenterViewModels('saoc-symposium') or loadTicketCardViewModel('saoc-symposium')
// (or both) satisfies this; what's pinned is the additive-only diff shape, proven by
// ./_render-unchanged.mjs exactly as A10/A11 prove it for their own pages.
import { checkAdditiveLoaderWiring } from './_render-unchanged.mjs';
import { finish } from './_lib.mjs';

const REL_PATH = 'app/(marketing)/national-show/symposium/page.tsx';

const failures = checkAdditiveLoaderWiring({
  relPath: REL_PATH,
  loaderImportPattern: /import\s*\{[^}]*\b(loadPresenterViewModels|loadTicketCardViewModel)\b[^}]*\}\s*from/,
  loaderCallPattern: /\b(loadPresenterViewModels|loadTicketCardViewModel)\s*\(/,
});

finish(
  'check-symposium-page-render-unchanged.mjs',
  failures,
  `${REL_PATH} gains an additive loader call with zero removed/changed lines — the existing render tree is provably byte-for-byte unchanged.`,
);
