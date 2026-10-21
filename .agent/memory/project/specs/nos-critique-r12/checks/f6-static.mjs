// nos-critique-r12 f6 static (QA input, hash-locked). F6: ONE section gap after a section-ending status disclosure (what-to-expect, workshops).
//   S1  nos-structure.css only gains lines: every BASE line is still there, in order, and the shared rhythm (.nos-section and .nk-section padding-block,
//       .nos-section-joined) is untouched, so no other route's section spacing can move through the stylesheet.
//   S2  docs/nos-critique-r12.md records F6.
import { DOC, finish, readBaseFile, readRepoFile } from './_lib.mjs';

const NAME = 'f6-static.mjs';
const CSS = 'app/(marketing)/national-show/nos-structure.css';
const failures = [];

// S1
const head = readRepoFile(CSS);
const base = readBaseFile(CSS);
if (head === null || base === null) failures.push(`${CSS} is missing at HEAD or BASE (S1)`);
else {
  const h = head.split('\n');
  let i = 0;
  for (const line of base.split('\n')) {
    while (i < h.length && h[i] !== line) i++;
    if (i === h.length) { failures.push(`${CSS}: BASE line removed or changed: "${line.trim().slice(0, 80)}" (S1, additions only)`); break; }
    i++;
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = (src, sel) => (src.match(new RegExp(`\\.nos-theme ${esc(sel)} \\{[^}]*\\}`, 'g')) ?? []).join('\n');
  for (const sel of ['.nos-section', '.nk-section', '.nos-section-joined']) {
    if (rule(head, sel) !== rule(base, sel)) failures.push(`${CSS}: the shared ${sel} rule changed (S1)`);
  }
}

// S2
const doc = readRepoFile(DOC);
if (doc === null || !/\bF6\b/.test(doc)) failures.push(`${DOC} must record F6 (S2)`);

finish(NAME, failures, 'nos-structure.css only gains lines and keeps the shared section rhythm rules; docs record F6.');
