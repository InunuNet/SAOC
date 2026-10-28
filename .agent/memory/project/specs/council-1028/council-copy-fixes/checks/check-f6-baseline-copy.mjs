// council-copy-fixes A9 (replaces running nos-critique-r12 f6-rendered.mjs, which is dead on origin/main: it requests /national-show/* on the default host,
// which the NOS split retired, so `next start` never answers /national-show with 200; measured on origin/main 63146ec5 with the same output as this branch).
// The only thing this mission touches in that check is its baseline's copy ("meet orchid societies"). So assert exactly that: the f6 baseline at HEAD equals
// the baseline at origin/main with the copy-map substitutions applied and nothing else changed, and no before-string remains in it.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MAP = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json', 'utf8'));
const FILE = '.agent/memory/project/specs/nos-critique-r12/goldens/f6-baseline.json';
const BASE = process.env.COUNCIL_DIFF_BASE ?? 'origin/main';
const was = spawnSync('git', ['show', `${BASE}:${FILE}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (was.status !== 0) { console.error(`FAIL f6-baseline-copy: cannot read ${FILE} at ${BASE}: ${was.stderr}`); process.exit(1); }
const subs = [...MAP.entries.map((e) => [e.before, e.after]), ...MAP.pinSubs.map((p) => [p.from, p.to])];
let expected = was.stdout; let applied = 0;
for (const [from, to] of subs) { const n = expected.split(from).length - 1; if (n) { applied += n; expected = expected.split(from).join(to); } }
const now = readFileSync(FILE, 'utf8');
const fails = [];
if (applied === 0) fails.push(`no copy-map substitution applies to ${FILE} at ${BASE}: the pin was already corrected or the map is wrong`);
if (now !== expected) fails.push(`${FILE} at HEAD differs from ${BASE} with the copy-map substitutions applied (something other than the council copy changed)`);
for (const [from] of subs) if (now.includes(from)) fails.push(`${FILE} still carries "${from}"`);
if (fails.length) { console.error(`FAIL f6-baseline-copy:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log(`PASS f6-baseline-copy: baseline equals ${BASE} + ${applied} council substitution(s), nothing else`);
