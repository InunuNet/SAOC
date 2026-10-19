// nos-critique-r17 F1 static (QA input, hash-locked). Goldens: goldens/f1-edits.json, f1-footprint.json.
//   S1  app/(marketing)/national-show/tickets/page.tsx equals BASE with exactly the two golden lines changed: the exhibitor card's body
//       loses "Entry sales are not yet open — they open closer to the show." (no replacement copy) and its href becomes the trader card's
//       vendor-application href. The CTA label "Exhibitor entry" and every other line stay.
//   S2  NO INVENTION: no new prose literal in the F1 file that is not already in BASE.
//   S3  docs/nos-critique-r17.md has a "## F1" section.
import { DOC, finish, goldenJson, readRepoFile } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f1-static.mjs';
const G = goldenJson('f1-edits.json');
const FP = goldenJson('f1-footprint.json');
const failures = [];

// S1
failures.push(...exactEdits(G.file, G.lineEdits, [], 'S1'));

// S2
for (const f of FP) failures.push(...newProse(f, FP));

// S3
if (!/^## F1\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F1" section (S3)`);

finish(NAME, failures, 'F1 static: the tickets hub is BASE + the two golden lines (sentence removed, exhibitor href = vendor application), no new copy, docs F1.');
