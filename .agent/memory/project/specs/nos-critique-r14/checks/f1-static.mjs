// nos-critique-r14 f1 static (QA input, hash-locked). F1: one section unit between adjacent full sections on the tickets hub (Codi FINAL 2026-10-18).
//   S1  nos-structure.css only gains lines: every BASE line is still there, in order, so the shared rhythm (.nos-section, .nk-section,
//       .nos-section-joined) and the r12 F6 disclosure rules are untouched.
//   S2  the added lines declare no new custom property and no new length: outside comments, the only number they may carry is 0
//       (the follower's top padding goes; the unit itself stays the existing clamp(72px, 9vw, 120px)).
//   S3  docs/nos-critique-r14.md records F1 and Codi's ruling.
import { CSS, DOC, finish, readBaseFile, readRepoFile } from './_lib.mjs';

const NAME = 'f1-static.mjs';
const failures = [];

const head = readRepoFile(CSS);
const base = readBaseFile(CSS);
if (head === null || base === null) failures.push(`${CSS} is missing at HEAD or BASE (S1)`);
else {
  // S1
  const h = head.split('\n');
  const added = [];
  let i = 0;
  for (const line of base.split('\n')) {
    while (i < h.length && h[i] !== line) added.push(h[i++]);
    if (i === h.length) { failures.push(`${CSS}: BASE line removed or changed: "${line.trim().slice(0, 80)}" (S1, additions only)`); break; }
    i++;
  }
  added.push(...h.slice(i));
  // S2
  const code = added.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/--[\w-]+\s*:/.test(code)) failures.push(`${CSS}: the added lines declare a custom property; no new tokens (S2)`);
  const lengths = code.match(/(?<![\w-])\d*\.?\d+(px|rem|em|vw|vh|%)/g) ?? [];
  if (lengths.length) failures.push(`${CSS}: the added lines carry new lengths ${JSON.stringify(lengths)}; only 0 is allowed (S2)`);
  if (added.filter((l) => l.trim()).length === 0) failures.push(`${CSS}: no rule added (S2)`);
}

// S3
const doc = readRepoFile(DOC);
if (doc === null || !/\bF1\b/.test(doc) || !/Codi/.test(doc)) failures.push(`${DOC} must record F1 and Codi's ruling (S3)`);

finish(NAME, failures, 'nos-structure.css only gains lines with no new token or length; docs record F1.');
