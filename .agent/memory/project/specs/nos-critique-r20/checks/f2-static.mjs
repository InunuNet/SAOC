// nos-critique-r20 F2 static (QA input, hash-locked). Goldens: goldens/f2-edits.json, f2-footprint.json, f2-spec.md.
//   S1  app/(marketing)/national-show/nos-structure.css equals BASE plus exactly one rule block after line 570 (the r14 tickets-hub rule):
//       the follower of two adjacent same-tone .nos-section siblings loses its padding-top (default ground, gold, royal, black; a bg-
//       utility section never matches).
//   S2  docs/nos-critique-r20.md has a "## F2" section.
import { DOC, finish, goldenJson, readRepoFile } from './_lib.mjs';
import { exactEdits } from './_edits.mjs';

const NAME = 'f2-static.mjs';
const G = goldenJson('f2-edits.json');
const failures = [...exactEdits(G.css.file, G.css.lineEdits, G.css.drops, 'S1')];
if (!/^## F2\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F2" section (S2)`);
finish(NAME, failures, 'F2 static: one same-tone section rule block in nos-structure.css, nothing else changed there; docs F2.');
