// nos-critique-r2 F1 — static checks on the six cleared route files (golden §2).
//   - no copy string is added, removed or changed (class-only edit; NO INVENTION);
//   - ShowContentState routes (sa-exhibitors, international-guests, programme) wrap it in the
//     critique-r1 scoped wrapper; about / what-to-expect / faq cap their page-local prose;
//   - no cap may target li outside .nos-show-page-prose, nor [data-nos-content-state] (the
//     Codex P2 lesson from critique-r1: grid cards must keep their tracks).
//
// Run as: node contracts/checks/nos-critique-r2/check-static.mjs
import { FILES, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static.mjs';
const failures = [];
const WRAPPER = 'contents [&_.nos-show-page-prose_p]:max-w-[60ch] [&_.nos-show-page-prose_li]:max-w-[60ch]';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WRAPPED = new RegExp(`<div\\s+className="${esc(WRAPPER)}"\\s*>\\s*<ShowContentState\\b`);

const REQUIRED = {
  about: ['[&>p]:max-w-[60ch]'],
  'what-to-expect': ['[&>p]:max-w-[60ch]', '[&_p]:max-w-[60ch]'],
  'sa-exhibitors': ['<div className="[&_p]:max-w-[60ch]">'],
  'international-guests': ['<div className="[&_p]:max-w-[60ch]">'],
  programme: [],
  faq: ['[&_details_p]:max-w-[60ch]'],
};

for (const [route, rel] of Object.entries(FILES)) {
  const raw = readRepoFile(rel);
  if (!raw) { failures.push(`missing ${rel}`); continue; }
  const src = stripComments(raw);
  const before = copyStrings(readBaseFile(rel)).sort().join('\n');
  const after = copyStrings(raw).sort().join('\n');
  if (before !== after) failures.push(`${rel}: copy strings changed — this feature is class-only`);
  if ((src.match(/<ShowContentState\b/g) || []).length > 0 && !WRAPPED.test(src)) {
    failures.push(`${rel}: <ShowContentState> must be the first child of <div className="${WRAPPER}">`);
  }
  for (const token of REQUIRED[route]) if (!src.includes(token)) failures.push(`${rel}: missing ${token}`);
  if (/\[&_\[data-nos-content-state\]/.test(src) || /\[&(?:_|>)(?:li|ul|ol)\b/.test(src)) {
    failures.push(`${rel}: no cap may target [data-nos-content-state] or li/ul/ol outside .nos-show-page-prose`);
  }
  if (/max-w-\[(6[1-9]|[7-9]\d|\d{3})ch\]/.test(src)) failures.push(`${rel}: no prose cap wider than 60ch`);
}
// sa-exhibitors / international-guests: the [&_p] cap wraps the empty listing only, never the grid.
for (const route of ['sa-exhibitors', 'international-guests']) {
  const src = stripComments(readRepoFile(FILES[route]) ?? '');
  if (!/<div className="\[&_p\]:max-w-\[60ch\]">\s*<RealEmptyListing\b/.test(src)) {
    failures.push(`${FILES[route]}: <RealEmptyListing> must be the first child of <div className="[&_p]:max-w-[60ch]"> (the grid branch is not wrapped)`);
  }
}
// faq: the page-local contact note takes the cap directly.
{
  const src = stripComments(readRepoFile(FILES.faq) ?? '');
  if (!/<p className="[^"]*\bmax-w-\[60ch\][^"]*">\s*\{info\.faqContactNote\}/.test(src)) failures.push(`${FILES.faq}: the faqContactNote <p> must carry max-w-[60ch]`);
}

finish(NAME, failures, 'six routes cap prose at 60ch page-locally (scoped, no grid li), with copy unchanged.');
