// nos-critique-r13 f1 static (QA input, hash-locked). F1: titles follow their h1 wording (Codi R64).
//   S1  each of the five EDITS files equals BASE with exactly its listed whole-line replacements (title, and its og image line where it has one).
//   S2  F24-A2's titles.json equals BASE with exactly the /about and /contact values superseded (goldens/supersession.json).
//   S3  docs/nos-critique-r13.md records F1 and R64.
import { DOC, finish, readBaseFile, readRepoFile } from './_lib.mjs';
import { EDITS, TITLES_JSON, TITLES_JSON_EDITS } from './_r13.mjs';

const NAME = 'f1-static.mjs';
const failures = [];

function exactEdit(rel, lines, tag) {
  const head = readRepoFile(rel);
  const base = readBaseFile(rel);
  if (head === null || base === null) { failures.push(`${rel} is missing at HEAD or BASE (${tag})`); return; }
  let want = base;
  for (const [from, to] of lines) {
    const hits = base.split('\n').filter((l) => l === from).length;
    if (hits !== 1) { failures.push(`${rel}: BASE holds ${hits} copies of "${from.trim()}"; BASE is not the audited 5f8d2311 (${tag})`); return; }
    want = want.split('\n').map((l) => (l === from ? to : l)).join('\n');
  }
  if (head !== want) failures.push(`${rel} must equal BASE with only ${lines.map(([, to]) => `"${to.trim()}"`).join(' and ')} changed (${tag})`);
}

// S1
for (const e of EDITS) exactEdit(e.file, e.lines, 'S1');
// S2
exactEdit(TITLES_JSON, TITLES_JSON_EDITS, 'S2');
// S3
const doc = readRepoFile(DOC);
if (doc === null || !/\bF1\b/.test(doc) || !/R64/.test(doc)) failures.push(`${DOC} must record F1 and Codi R64 (S3)`);

finish(NAME, failures, `${EDITS.length} pages change only their title (and og image) line to the h1 wording, titles.json supersedes /about and /contact, docs record F1.`);
