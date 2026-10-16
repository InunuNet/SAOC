// nos-critique-r3 F2 — static source check for R43 (golden spec-f2 §2, §3).
//   R43 P1  the internal order note is replaced by the existing R11 chip, reused not hand-rolled:
//           <ConfirmationBadge status="pending" pendingLabel="To be confirmed by the show committee" />,
//           imported from '@/components/show', rendered only when the order is provisional; no
//           "Sample sequence", no .pc-order-note, no new copy
//   R43 P2  each running-prose class string moves from its sub-16px size to the body role (class-only
//           edits: the old string is gone, the new string is present, nothing else in the line changes)
// NOS_CR3_ROOT runs it against a fixture copy. Run as: node contracts/checks/nos-critique-r3/check-static-f2.mjs
import { SECTION, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); };
const NS = 'app/(marketing)/national-show';

// [file, old class string, new class string, min occurrences of the new string]
const PAIRS = [
  ['components/home/NavCards.tsx', 'font-sans text-[13px] text-ink/70 leading-relaxed mb-4', 'font-sans text-[16px] text-ink/70 leading-relaxed mb-4', 1],
  ['components/home/PartnersSection.tsx', 'mt-3 block text-[15px] text-muted leading-relaxed', 'mt-3 block text-[16px] text-muted leading-relaxed', 1],
  ['components/nos/VisitorLinkCard.tsx', 'font-sans text-[14px] leading-relaxed text-muted">{description}', 'font-sans text-[17px] leading-relaxed text-muted">{description}', 1],
  ['components/nos/JudgingGroupCard.tsx', 'font-sans text-[13px] leading-relaxed text-muted">{description}', 'font-sans text-[16px] leading-relaxed text-muted">{description}', 1],
  ['components/nos/ExhibitorStageCard.tsx', 'font-sans text-[14px] leading-relaxed text-[var(--lilac-pale)]', 'font-sans text-[17px] leading-relaxed text-[var(--lilac-pale)]', 1],
  ['components/show/VenueCard.tsx', 'not-italic font-sans text-[15px] leading-relaxed text-ink/80', 'not-italic font-sans text-[17px] leading-relaxed text-ink/80', 1],
  ['components/show/VenueCard.tsx', 'mt-5 font-sans text-[15px] leading-relaxed text-ink/70', 'mt-5 font-sans text-[17px] leading-relaxed text-ink/70', 1],
  ['components/show/ExhibitorKeyDates.tsx', 'max-sm:py-1 font-sans text-[15px] leading-relaxed text-ink/80', 'max-sm:py-1 font-sans text-[17px] leading-relaxed text-ink/80', 1],
  ['components/show/ExhibitorKeyDates.tsx', 'max-sm:pb-4 font-sans text-[15px] leading-relaxed text-ink/70', 'max-sm:pb-4 font-sans text-[17px] leading-relaxed text-ink/70', 1],
  ['components/show/ExhibitorQuestions.tsx', 'mt-2 font-sans text-[15px] leading-relaxed text-ink/70', 'mt-2 font-sans text-[17px] leading-relaxed text-ink/70', 1],
  ['components/show/ShowFaqList.tsx', 'max-w-3xl font-sans text-[15px] leading-relaxed text-ink/80', 'max-w-3xl font-sans text-[17px] leading-relaxed text-ink/80', 1],
  ['components/show/nos/RealEmptyListing.tsx', '<p className="font-sans text-[15px] leading-relaxed text-ink/80">{absenceStatement}', '<p className="font-sans text-[17px] leading-relaxed text-ink/80">{absenceStatement}', 1],
  [`${NS}/page.tsx`, 'mt-14 border-t border-rule pt-8 font-sans text-[15px] text-ink/70', 'mt-14 border-t border-rule pt-8 font-sans text-[17px] text-ink/70', 1],
  [`${NS}/plan-your-visit/page.tsx`, 'mt-2 font-sans text-[14px] leading-relaxed text-muted', 'mt-2 font-sans text-[17px] leading-relaxed text-muted', 1],
  [`${NS}/plan-your-visit/page.tsx`, 'mt-2 font-sans text-[13px] leading-snug text-muted', 'mt-2 font-sans text-[17px] leading-snug text-muted', 1],
  [`${NS}/what-to-expect/page.tsx`, 'mt-2 font-sans text-[13px] leading-snug text-muted', 'mt-2 font-sans text-[17px] leading-snug text-muted', 1],
  [`${NS}/tickets/page.tsx`, 'font-sans text-[14px] leading-relaxed text-muted"', 'font-sans text-[17px] leading-relaxed text-muted"', 2],
];
const files = new Map();
const src = (rel) => { if (!files.has(rel)) files.set(rel, readRepoFile(rel)); return files.get(rel); };
for (const [rel, oldS, newS, min] of PAIRS) {
  const text = src(rel);
  if (text === null) { failures.push(`missing ${rel}`); continue; }
  expect(!text.includes(oldS), `${rel}: still has the sub-16px class string "${oldS}"`);
  const n = text.split(newS).length - 1;
  expect(n >= min, `${rel}: expected >= ${min} of "${newS}", found ${n}`);
}

// ---- PresenterSection: R11 chip ----
const sectionRaw = readRepoFile(SECTION);
if (!sectionRaw) finish('check-static-f2.mjs', [`missing ${SECTION}`]);
const section = stripComments(sectionRaw);
const flat = section.replace(/\s+/g, ' ');
expect(!/Sample sequence|Lee-Ann will confirm|pc-order-note/.test(section), 'the internal order note and .pc-order-note must be gone');
expect(/import \{[^}]*\bConfirmationBadge\b[^}]*\} from '@\/components\/show';/.test(section), "ConfirmationBadge must be imported from '@/components/show' (reuse, do not hand-roll)");
expect(/\{provisional \? \(?\s*<ConfirmationBadge status="pending" pendingLabel="To be confirmed by the show committee" \/>\s*\)? : null\}/.test(flat), 'the chip must render only when `provisional`: {provisional ? <ConfirmationBadge status="pending" pendingLabel="To be confirmed by the show committee" /> : null}');
const baseCopy = new Set(copyStrings(readBaseFile(SECTION)));
for (const c of copyStrings(sectionRaw)) {
  if (!baseCopy.has(c) && c !== 'To be confirmed by the show committee' && !/^Presenters \(/.test(c)) failures.push(`new copy string in PresenterSection: ${JSON.stringify(c)}`);
}

// ---- docs ----
const docs = readRepoFile('docs/nos-critique-r3.md');
expect(docs !== null && /R43/.test(docs), 'docs/nos-critique-r3.md must record R43');
if (docs) {
  expect(/colors_and_type\.css/.test(docs) && /--body-md|16px/.test(docs), 'docs must cite the handoff body tokens (colors_and_type.css --body-md 16px) for the 16px floor');
  expect(/tickets\/page\.tsx/.test(docs) && /national-show\/page\.tsx/.test(docs), 'docs must list the hub and tickets page files touched (merge-collision note)');
  expect(/meta/i.test(docs) && /EXEMPT|exempt|stays/i.test(docs), 'docs must list which elements were judged meta and left alone, with reasons');
}

finish('check-static-f2.mjs', failures, 'R43 class edits and R11 chip reuse match the golden; no new copy.');
