// One-time record pass for the A17 fixture misses (approved by the lead, comms.md; run ONCE by the dev, never in a loop).
//   1. bash/node A17 once in replay:   node .agent/memory/project/specs/nos-content-standard/checks/gate-e2e.mjs   (expected to fail on misses)
//   2. NOS_STD_FIXTURE=record node .agent/memory/project/specs/nos-content-standard/checks/record-e2e-misses.mjs
//   3. re-run A17 in replay: it must show zero misses.
// Record mode already serves an existing fixture file from disk and calls the API HOST (useCdn:false, never apicdn) only for a query with no file, so this pass
// reads only what is missing. Guards: (a) it refuses to start unless step 1's _misses.log names 1..CAP distinct keys; (b) it polls the fixture dir while the suite
// runs and kills the exact process group it spawned if more than CAP new files appear (abort, nothing retried); (c) afterwards it requires every new file's key to be
// one of the logged misses or reports the extras, then rebuilds manifest.json (check-fixture-files.mjs --write-manifest).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { FIXTURE_MODE, FIXTURE_DIR, BASE_PORT, fixtureEnv, fixtureLogDir } from './_lib.mjs';

const CAP = 40;
const LOG_OFFSET = 4; // the same log dir gate-e2e.mjs uses
const E2E_CMD = ['bash', 'scripts/ci-e2e.sh', 'pnpm', 'test:e2e'];
const E2E_TIMEOUT_MS = 25 * 60 * 1000;
const POLL_MS = 500;
const die = (m) => { console.error(`RECORD ABORTED: ${m}`); process.exit(1); };

if (FIXTURE_MODE !== 'record') die('set NOS_STD_FIXTURE=record (this script is the only sanctioned record pass for A17)');
const logdir = fixtureLogDir(BASE_PORT + LOG_OFFSET);
const missLog = `${logdir}/_misses.log`;
if (!existsSync(missLog)) die(`no ${missLog}: run A17 in replay first`);
const missed = [...new Set(readFileSync(missLog, 'utf8').split('\n').filter(Boolean).map((l) => (l.match(/[0-9a-f]{64}/) ?? [])[0]).filter(Boolean))];
if (missed.length === 0) die('step 1 logged no miss: nothing to record');
if (missed.length > CAP) die(`${missed.length} distinct misses exceeds the cap of ${CAP}; the lead decides`);
console.log(`recording at most ${CAP} reads; ${missed.length} logged miss(es): ${missed.map((k) => k.slice(0, 10)).join(' ')}`);
writeFileSync(`${logdir}/_record-targets.json`, `${JSON.stringify(missed)}\n`);

const filesNow = () => new Set(readdirSync(FIXTURE_DIR).filter((n) => /^[0-9a-f]{64}\.json$/.test(n)));
const before = filesNow();
const env = { ...process.env, CI: '1', ...fixtureEnv(BASE_PORT + LOG_OFFSET) }; // fixtureEnv truncates the logs; the misses were read above
delete env.K_SERVICE; delete env.SAOC_E2E_DYNAMIC_PORT;
const child = spawn(E2E_CMD[0], E2E_CMD.slice(1), { env, stdio: 'inherit', detached: true });
let aborted = false;
const killGroup = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } }; // the exact group this script spawned, by PID
const poll = setInterval(() => {
  const added = [...filesNow()].filter((n) => !before.has(n)).length;
  if (added > CAP) { aborted = true; console.error(`cap hit: ${added} new fixture files > ${CAP}`); killGroup(); }
}, POLL_MS);
const timer = setTimeout(() => { aborted = true; console.error('timeout'); killGroup(); }, E2E_TIMEOUT_MS);
const status = await new Promise((resolve) => child.on('exit', (code) => resolve(code)));
clearInterval(poll); clearTimeout(timer);

const added = [...filesNow()].filter((n) => !before.has(n)).map((n) => n.replace(/\.json$/, ''));
console.log(`new fixture files: ${added.length}`);
const extras = added.filter((k) => !missed.includes(k));
if (aborted) die(`aborted by the cap or timeout after ${added.length} new file(s); no manifest written`);
if (added.length > CAP) die(`${added.length} new files exceed the cap`);
if (extras.length) console.error(`NOTE: ${extras.length} recorded key(s) were not in step 1's miss list (queries only reachable after a first miss unblocked a page): ${extras.map((k) => k.slice(0, 10)).join(' ')}`);
const m = spawnSync('node', ['.agent/memory/project/specs/nos-content-standard/checks/check-fixture-files.mjs', '--write-manifest', logdir], { stdio: 'inherit' });
if (m.status !== 0) die('manifest rebuild failed');
console.log(`record pass done (suite exit ${status}). Now re-run A17 in replay: zero misses is required.`);
