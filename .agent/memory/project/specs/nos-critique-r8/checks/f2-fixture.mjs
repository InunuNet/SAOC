// nos-critique-r8 f2 fixture (Codi FINAL, P2): the Getting-there lede (gettingThereIntro, "... has not been worked out yet ...") shows only while EVERY drawn item is unconfirmed.
// Contract for the dev: components/show/VisitDisclosure.tsx exports gettingThereLede(intro, items) -> string | undefined, items = the same VisitGettingThereItem[] the page passes to
// VisitGettingThere. Any status but 'confirmed' (pending, research, unset) counts as unconfirmed. Shown = the trimmed intro; withheld = undefined (the page passes it to SectionHeading lede).
// Decision recorded: an empty item list is "every item unconfirmed" (vacuous), so the lede shows. A blank or missing intro stays withheld.
// Dry run only: NOS_CR8_VISIT_COMPONENT points at a reference implementation.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { finish, repoRoot, specDir } from './_lib.mjs';

const NAME = 'f2-fixture.mjs';
const failures = [];
const comp = process.env.NOS_CR8_VISIT_COMPONENT ?? path.join(repoRoot, 'components/show/VisitDisclosure.tsx');
const INTRO = 'INTRO-FROM-THE-CMS';

let r;
try {
  r = JSON.parse(execFileSync(path.join(repoRoot, 'node_modules/.bin/tsx'), [path.join(specDir, 'checks/f2-fixture-run.mjs'), repoRoot, comp], { cwd: repoRoot, encoding: 'utf8' }));
} catch (e) {
  finish(NAME, [`could not run gettingThereLede from ${comp}: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' | ')}`]);
}
const WANT = {
  noneConfirmed: INTRO, pendingAndResearch: INTRO, unsetStatus: INTRO, noItems: INTRO,
  mixedFirst: null, mixedLast: null, allConfirmed: null, noneConfirmedNoIntro: null, blankIntro: null,
};
for (const [name, want] of Object.entries(WANT)) if (r[name] !== want) failures.push(`[${name}]: lede ${JSON.stringify(r[name])}, want ${JSON.stringify(want)}`);

finish(NAME, failures, 'gettingThereLede shows the intro only while every item is unconfirmed (none-confirmed, pending+research, unset, no items) and withholds it when any item is confirmed or the intro is blank.');
