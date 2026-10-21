// nos-critique-r10 f2 static (R50 P1, lead-approved): on what-to-expect the "Show dates" card moves above the R11 disclosure (ShowHoldingNote). Block reorder only.
//   S1  page.tsx equals BASE with exactly one edit: the {dateRange ? (<section ... "Show dates" ...>) : null} block (BASE :147-157) cut and re-inserted, byte for byte, directly before
//       the {heldBack.length > 0 ? (<ShowHoldingNote .../>) : null} block (BASE :143-145), so the NosSection opens dates, disclosure, hours, admission, food, photography,
//       cloakroom, accessibility. No copy, class, prop or disclosure change. The `export const metadata` statement and the import lines are masked on both sides, so F24's
//       metadata edit, merged by keeping both, does not fail this check; everything else must match.
//   S2  docs/nos-critique-r10.md exists
import { DOC, NS, finish, readBaseFile, readRepoFile } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const PAGE = `${NS}/what-to-expect/page.tsx`;
const NOTE = /^ {8}\{heldBack\.length > 0 \? \(\n[^]*?\n {8}\) : null\}\n\n/m;
const DATES = /^ {8}\{dateRange \? \(\n {10}<section className="nos-surface">\n {12}<SectionHeading as="h2" title="Show dates" \/>\n[^]*?\n {8}\) : null\}\n\n/m;
const mask = (s) => s.replace(/^export const metadata[^]*?\n\}\);\n/m, '<metadata>\n').replace(/^import [^]*?;\n/gm, '');

const head = readRepoFile(PAGE);
const base = readBaseFile(PAGE);
if (head === null || base === null) fail(`${PAGE} is missing at HEAD or BASE`);
else {
  const note = base.match(NOTE);
  const dates = base.match(DATES);
  if (!note || !dates || dates.index < note.index) fail('BASE is not the audited d05c85a5 layout (holding note, then the Show dates block) (S1)');
  else {
    const want = base.slice(0, note.index) + dates[0] + note[0] + base.slice(note.index + note[0].length, dates.index) + base.slice(dates.index + dates[0].length);
    if (mask(head) !== mask(want)) fail('what-to-expect/page.tsx must equal BASE with only the Show dates block moved directly above the holding note (metadata and imports aside) (S1)');
  }
}
if (readRepoFile(DOC) === null) fail(`${DOC} is missing (S2)`);

finish('f2-static.mjs', failures, 'what-to-expect/page.tsx is BASE with the Show dates block moved, byte for byte, directly above the R11 disclosure; nothing else changed (metadata and imports masked).');
