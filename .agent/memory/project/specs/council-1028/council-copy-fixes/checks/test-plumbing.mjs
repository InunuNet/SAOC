// Proof for the A4 plumbing normaliser: the real dev-branch files pass, a deleted assertion line fails, a removed route fails, a tampered override block fails,
// and an untouched gate-verbatim.mjs passes while an edited one fails. REAL_REF defaults to HEAD (on the spec branch HEAD equals base, so every file passes).
import { spawnSync } from 'node:child_process';
import { checkPlumbing, PLUMBING } from './check-plumbing.mjs';

const BASE = process.env.COUNCIL_DIFF_BASE ?? 'origin/main'; const REAL = process.env.COUNCIL_TEST_REAL_REF ?? 'HEAD';
const show = (ref, f) => { const r = spawnSync('git', ['show', `${ref}:${f}`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); if (r.status !== 0) { console.error(r.stderr); process.exit(2); } return r.stdout; };
const [LIB, STD, VERB] = PLUMBING; let bad = 0;
const expect = (name, problems, wantFail) => { const ok = wantFail ? problems.length > 0 : problems.length === 0; if (!ok) bad += 1; console.log(`${ok ? 'ok  ' : 'BAD '} ${name}: ${problems.length} problem(s), want ${wantFail ? 'FAIL' : 'PASS'}${!ok && problems.length ? '\n     ' + problems.join('\n     ') : ''}`); };

for (const f of PLUMBING) expect(`real ${REAL}: ${f.split('/').pop()}`, checkPlumbing(f, show(REAL, f), show(BASE, f)), false);
const std = show(REAL, STD); const lib = show(REAL, LIB); const verb = show(BASE, VERB);
const dropLine = (t, re) => { const L = t.split('\n'); const i = L.findIndex((l) => re.test(l)); if (i < 0) { console.error(`test setup: no line matches ${re}`); process.exit(2); } L.splice(i, 1); return L.join('\n'); };
expect('gate-standard with a deleted assertion line', checkPlumbing(STD, dropLine(std, /c\.check\(/), show(BASE, STD)), true);
expect('gate-standard with a removed route', checkPlumbing(STD, std.replace('ROUTES.filter', 'ROUTES.slice(1).filter').replace('for (const r of ROUTES)', 'for (const r of ROUTES.slice(1))').replace('ROUTES', 'ROUTES.slice(1)'), show(BASE, STD)), true);
expect('gate-standard with a weakened comparison', checkPlumbing(STD, std.replace('.trim()', ''), show(BASE, STD)), true);
const tampered = lib.replace('applyCouncil = (text, route = null) =>', 'applyCouncil = (text, route = null) => text.length > 0 ? text :');
if (tampered === lib) console.log('skip _lib with a tampered override block: this ref carries no override block (spec branch)');
else expect('_lib with a tampered override block', checkPlumbing(LIB, tampered, show(BASE, LIB)), true);
expect('_lib with a deleted unrelated line', checkPlumbing(LIB, dropLine(lib, /^export const BASE_PORT/), show(BASE, LIB)), true);
expect('gate-verbatim edited', checkPlumbing(VERB, `${verb}\n// extra\n`, verb), true);
expect('gate-verbatim untouched', checkPlumbing(VERB, verb, verb), false);
if (bad) { console.error(`FAIL test-plumbing: ${bad} case(s) wrong`); process.exit(1); }
console.log('PASS test-plumbing');
