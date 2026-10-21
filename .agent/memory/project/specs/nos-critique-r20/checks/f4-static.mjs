// nos-critique-r20 F4 static (QA input, hash-locked). Goldens: goldens/f4-edits.json, f4-footprint.json, f3-edits.json, f4-spec.md.
// F4 (Codi FINAL 2026-10-22): one shared footer row and list (FOOTER_RHYTHM in footer-data.ts) in BOTH footers. F3 and F4 edit the same
// SAOC files on different BASE lines, so S1/S2 pin each file as BASE plus exactly F3's and F4's line edits together.
//   S1  components/chrome/footer-data.ts equals BASE plus exactly F3's FOOTER_LAYOUT block and F4's FOOTER_RHYTHM block (list, row).
//   S2  components/chrome/Footer.tsx equals BASE plus exactly F3's and F4's line edits: FOOTER_RHYTHM imported, both lists on
//       FOOTER_RHYTHM.list (Partners' gap-2 gone), the Explore link, the Partners name and the WOSA link each led by FOOTER_RHYTHM.row.
//   S3  components/nos-chrome/NosFooter.tsx imports FOOTER_RHYTHM from footer-data and uses FOOTER_RHYTHM.list in 2 classNames and
//       FOOTER_RHYTHM.row in 3, as the golden markup (the two nf-list lists, the Explore link, the Partners name, the WOSA link).
//   S4  components/nos-chrome/nos-chrome.css carries each golden rule exactly once (the row geometry and size off .nf-list a/span,
//       .nf-wild a and .nf-list, the 16px column-heading margin) and none of the retired fragments.
//   S5  the submit behaviour is untouched (footer-newsletter-subscribe owns it): each footer has its BASE <form ... onSubmit> line once,
//       and neither form gains an action, formAction or FormData reader.
//   S6  NO INVENTION: no new prose literal in the F4 files that is not already in BASE.
//   S7  docs/nos-critique-r20.md has a "## F4" section.
import { DOC, finish, goldenJson, readRepoFile } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f4-static.mjs';
const G = goldenJson('f4-edits.json');
const G3 = goldenJson('f3-edits.json');
const FP = goldenJson('f4-footprint.json');
const failures = [];
const count = (text, needle) => text.split(needle).length - 1;
const both = (f3, f4) => [[...f3.lineEdits, ...f4.lineEdits], [...f3.drops, ...f4.drops]];

failures.push(...exactEdits(G.footerData.file, ...both(G3.footerData, G.footerData), 'S1'));
failures.push(...exactEdits(G.saocFooter.file, ...both(G3.saocFooter, G.saocFooter), 'S2'));

const N = G.nosFooter;
const tsx = readRepoFile(N.file);
if (tsx === null) failures.push(`${N.file}: missing (S3)`);
else {
  if (!new RegExp(`import \\{[^}]*\\b${N.import}\\b[^}]*\\} from '@\\/components\\/chrome\\/footer-data';`).test(tsx)) failures.push(`${N.file}: ${N.import} is not imported from @/components/chrome/footer-data (S3)`);
  for (const [k, want] of Object.entries(N.uses)) {
    const uses = (tsx.match(new RegExp(`className=\\{(?:\`[^\`]*\\$\\{FOOTER_RHYTHM\\.${k}\\}[^\`]*\`|FOOTER_RHYTHM\\.${k})\\}`, 'g')) ?? []).length;
    if (uses !== want) failures.push(`${N.file}: FOOTER_RHYTHM.${k} is used in ${uses} classNames, want ${want} (S3)`);
  }
  if (count(tsx, N.lists) !== 2) failures.push(`${N.file}: ${count(tsx, N.lists)} copies of ${N.lists}, want 2 (S3)`);
  for (const r of N.rows) if (count(tsx, r) !== 1) failures.push(`${N.file}: ${count(tsx, r)} copies of ${r}, want 1 (S3)`);
}

const C = G.nosCss;
const css = readRepoFile(C.file);
if (css === null) failures.push(`${C.file}: missing (S4)`);
else {
  for (const r of C.rules) if (count(css, r) !== 1) failures.push(`${C.file}: ${count(css, r)} copies of ${JSON.stringify(r)}, want 1 (S4)`);
  for (const gone of C.retired) if (css.includes(gone)) failures.push(`${C.file}: still carries ${JSON.stringify(gone)} (S4)`);
}

for (const [file, form] of [[G.saocFooter.file, G.submit.saoc], [N.file, G.submit.nos]]) {
  const src = readRepoFile(file) ?? '';
  if (count(src, form) !== 1) failures.push(`${file}: the BASE form line ${JSON.stringify(form)} appears ${count(src, form)} times, want 1 (S5)`);
  if (/<form\b[^>]*\baction=|formAction|new FormData/.test(src)) failures.push(`${file}: the sign-up form gained submit wiring (S5: footer-newsletter-subscribe owns it)`);
}

for (const f of FP) failures.push(...newProse(f, [...FP], { allow: G.allowCopy ?? [] }));
if (!/^## F4\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F4" section (S7)`);

finish(NAME, failures, 'F4 static: FOOTER_RHYTHM (one list, one 44px row) defined once and used by both footers, the NOS row geometry off the unlayered rules, 16px column headings, the forms untouched, no new copy, docs F4.');
