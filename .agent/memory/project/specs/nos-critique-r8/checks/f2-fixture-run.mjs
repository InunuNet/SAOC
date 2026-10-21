// nos-critique-r8 f2 fixture runner (executed under the worktree's tsx by f2-fixture.mjs): calls gettingThereLede with props, no env or CMS involved.
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const comp = path.resolve(process.argv[3]);
const require = createRequire(path.join(root, 'package.json'));
globalThis.React = require('react'); // the repo tsconfig keeps jsx: preserve, so tsx falls back to the classic runtime
const { gettingThereLede } = await import(comp);

const INTRO = 'INTRO-FROM-THE-CMS';
const it = (...statuses) => statuses.map((status, i) => ({ heading: `Item ${i}`, body: 'body', status }));
const CASES = {
  noneConfirmed: [INTRO, it('pending', 'pending', 'pending')],
  pendingAndResearch: [INTRO, it('pending', 'research', 'pending')],
  unsetStatus: [INTRO, it(undefined, null, undefined)],
  mixedFirst: [INTRO, it('confirmed', 'pending', 'pending')],
  mixedLast: [INTRO, it('pending', 'pending', 'confirmed')],
  allConfirmed: [INTRO, it('confirmed', 'confirmed', 'confirmed')],
  noItems: [INTRO, []],
  noneConfirmedNoIntro: [null, it('pending', 'pending', 'pending')],
  blankIntro: ['   ', it('pending', 'pending', 'pending')],
};
const out = {};
for (const [name, [intro, items]] of Object.entries(CASES)) out[name] = gettingThereLede(intro, items) ?? null;
process.stdout.write(JSON.stringify(out));
