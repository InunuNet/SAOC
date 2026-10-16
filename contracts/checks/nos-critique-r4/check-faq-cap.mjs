// nos-critique-r4 F1 — the FAQ route keeps its page-local 60ch prose cap (nos-critique-r2) untouched.
// Replaces the reused r2 check-static.mjs, which compares six routes against r2's own base and so
// trips on unrelated routes changed by later missions (programme, F8). Scoped to faq/page.tsx only.
//
// Run as: node contracts/checks/nos-critique-r4/check-faq-cap.mjs
import { PAGE, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-faq-cap.mjs';
const failures = [];
const raw = readRepoFile(PAGE);
if (raw === null) finish(NAME, [`${PAGE} missing`]);
else {
  const src = stripComments(raw);
  if (raw !== readBaseFile(PAGE)) failures.push(`${PAGE} differs from the base; R44-A3 needs no change to the route`);
  if (!src.includes('[&_details_p]:max-w-[60ch]')) failures.push(`${PAGE}: missing [&_details_p]:max-w-[60ch] on the content column`);
  if (!/<p className="[^"]*\bmax-w-\[60ch\][^"]*">\s*\{info\.faqContactNote\}/.test(src)) failures.push(`${PAGE}: the faqContactNote <p> must carry max-w-[60ch]`);
  if (/max-w-\[(6[1-9]|[7-9]\d|\d{3})ch\]/.test(src)) failures.push(`${PAGE}: no prose cap wider than 60ch`);
  finish(NAME, failures, 'faq/page.tsx unchanged from base and its 60ch caps are intact.');
}
