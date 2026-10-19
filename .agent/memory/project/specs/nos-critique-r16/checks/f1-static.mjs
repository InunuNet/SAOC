// nos-critique-r16 F1 static (QA input, hash-locked). Goldens: goldens/f1-edits.json, f1-footprint.json.
//   S1  exact edits: every file carrying golden lineEdits (sentence case, back link padding) equals BASE + exactly those lines; the
//       exhibitors page also drops the "← Show overview" paragraph (dropLines) and nothing else.
//   S2  the vendor submit buttons are the NOS Button: each target file imports it, renders <Button type="submit">, keeps its label, has one
//       raw <button> fewer than BASE and no bg-accent left.
//   S3  NO INVENTION: no new prose literal in the F1 files that is not already in BASE (programme cards reuse the hub's components/data).
//   S4  the programme page renders the hub's Programme section: it imports TicketSection and TicketCard from the keepsake components and
//       the hub keeps rendering the same section (TicketSection id="programme").
//   S5  docs/nos-critique-r16.md has a "## F1" section.
import { DOC, finish, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f1-static.mjs';
const G = goldenJson('f1-edits.json');
const FP = goldenJson('f1-footprint.json');
const failures = [];
const count = (s, sub) => s.split(sub).length - 1;

// S1
const byFile = new Map();
for (const e of [...G.sentenceCase.lineEdits, ...G.backLink.lineEdits]) byFile.set(e.file, [...(byFile.get(e.file) ?? []), e]);
for (const [file, edits] of byFile) {
  const drops = file === G.exhibitorsBackLink.file ? [G.exhibitorsBackLink.dropLines] : [];
  failures.push(...exactEdits(file, edits, drops, 'S1'));
}

// S2
for (const t of G.buttons.targets) {
  const head = readRepoFile(t.file) ?? '';
  const base = readBaseFile(t.file) ?? '';
  if (!head.includes(G.buttons.import)) failures.push(`${t.file}: does not import the NOS Button (${G.buttons.import}) (S2)`);
  if (!/<Button\b[^>]*type="submit"/.test(head)) failures.push(`${t.file}: no <Button type="submit"> (S2)`);
  if (!head.includes(t.label)) failures.push(`${t.file}: label "${t.label}" missing (S2)`);
  if (count(head, '<button') !== count(base, '<button') - 1) failures.push(`${t.file}: <button> count ${count(head, '<button')}, want BASE ${count(base, '<button')} - 1 (S2)`);
  if (head.includes('bg-accent')) failures.push(`${t.file}: still carries bg-accent (S2)`);
}

// S3
const CORPUS = [...FP, 'components/tickets/keepsake/TicketCard.tsx', 'components/tickets/keepsake/TicketSection.tsx', 'lib/data/ticket-section-ledes.ts'];
for (const f of FP) failures.push(...newProse(f, CORPUS, { caseOnly: true }));

// S4
const prog = readRepoFile('app/(marketing)/national-show/programme/page.tsx') ?? '';
for (const sym of ['TicketSection', 'TicketCard']) if (!new RegExp(`\\b${sym}\\b[\\s\\S]*from '@/components/tickets/keepsake'`).test(prog)) failures.push(`programme/page.tsx: does not import ${sym} from @/components/tickets/keepsake (S4)`);
if (!/<TicketSection\b[\s\S]*?id="programme"/.test(prog)) failures.push('programme/page.tsx: no <TicketSection id="programme"> (S4)');
const hub = readRepoFile('app/(marketing)/national-show/tickets/page.tsx') ?? '';
if (!/<TicketSection\b[\s\S]*?id="programme"/.test(hub)) failures.push('national-show/tickets/page.tsx: the hub lost its <TicketSection id="programme"> (S4)');

// S5
if (!/^## F1\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F1" section (S5)`);

finish(NAME, failures, `F1 static: ${byFile.size} files are BASE + exact golden edits, vendor submits are the NOS Button, no new copy, programme reuses the hub section, docs F1.`);
