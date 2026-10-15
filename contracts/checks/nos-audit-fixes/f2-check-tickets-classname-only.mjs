// F2 / A15 — guard: F1's tap-target edits to the shared ticket flow are className-only.
// F2-A8 excludes these three files from its "existing flow unchanged" diff because F1's golden
// (audit-fixes.golden.md, tap targets) legitimately resizes their controls. This check keeps
// the exclusion honest: compared with base 047d610e, each file keeps its line count, and every
// line that differs is a plain `className="..."` attribute line on both sides, with the same
// indentation. Any other edit (an onClick, an href, a handler, an added or removed line) fails.
import { execFileSync } from 'node:child_process';
import { BASE_SHA, fail, pass, readRepoFile, worktreeRoot } from './f2-_lib.mjs';

const ID = 'f2-tickets-classname-only';
const FILES = [
  'components/tickets/TicketTypeCard.tsx',
  'components/tickets/DayQuantityPicker.tsx',
  'components/tickets/TicketPurchaseForm.tsx',
];
const CLASSNAME_LINE = /^(\s*)className="[^"]*"$/;

const problems = [];
let changed = 0;
for (const rel of FILES) {
  const now = readRepoFile(rel);
  if (now === null) {
    problems.push(`${rel} is missing`);
    continue;
  }
  const before = execFileSync('git', ['-C', worktreeRoot, 'show', `${BASE_SHA}:${rel}`], { encoding: 'utf8' }).split('\n');
  const after = now.split('\n');
  if (before.length !== after.length) {
    problems.push(`${rel}: line count ${before.length} -> ${after.length} (lines added or removed)`);
    continue;
  }
  before.forEach((old, i) => {
    if (old === after[i]) return;
    changed += 1;
    const a = old.match(CLASSNAME_LINE);
    const b = after[i].match(CLASSNAME_LINE);
    if (!a || !b) problems.push(`${rel}:${i + 1} changed a non-className line: ${after[i].trim()}`);
    else if (a[1] !== b[1]) problems.push(`${rel}:${i + 1} className line re-indented`);
  });
}
if (problems.length) fail(ID, problems);
pass(ID, `${changed} className line(s) changed, nothing else`);
