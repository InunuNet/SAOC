// A16: the Sanity fixture is FAIL-CLOSED on the hosted runtime, same pattern as lib/fixture-route-guard.ts (K_SERVICE). Each case runs lib/sanity-fixture.ts's
// module load in a fresh child process (exactly what the server does at import time), so "throws at module load" is proven, not inferred.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROBE = '.agent/memory/project/specs/nos-content-standard/checks/fixture-load-probe.mjs';
const DIR = '.tmp/sandbox/fixture-hosted/fixtures';
const BASE = { PATH: process.env.PATH, HOME: process.env.HOME };
const run = (env) => { const r = spawnSync(process.execPath, [PROBE], { env: { ...BASE, ...env }, encoding: 'utf8' }); return { code: r.status, out: `${r.stdout}${r.stderr}`.trim() }; };
const cases = [
  ['hosted + mode replay + dir: module load THROWS', { K_SERVICE: 'saoc-hosting', SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: DIR }, 'throws'],
  ['hosted + mode record + dir + confirm flag: module load THROWS', { K_SERVICE: 'saoc-hosting', SANITY_FIXTURE_MODE: 'record', SANITY_FIXTURE_RECORD_CONFIRM: '1', SANITY_FIXTURE_DIR: DIR }, 'throws'],
  ['hosted + mode unset: loads, fixture inactive', { K_SERVICE: 'saoc-hosting' }, 'inactive'],
  ['hosted + mode off + dir: loads, fixture inactive', { K_SERVICE: 'saoc-hosting', SANITY_FIXTURE_MODE: 'off', SANITY_FIXTURE_DIR: DIR }, 'inactive'],
  ['hosted + dir only (no mode): loads, fixture inactive', { K_SERVICE: 'saoc-hosting', SANITY_FIXTURE_DIR: DIR }, 'inactive'],
  ['local + record WITHOUT the confirm flag: module load THROWS', { SANITY_FIXTURE_MODE: 'record', SANITY_FIXTURE_DIR: DIR }, 'throws'],
  ['local + replay WITHOUT a dir: module load THROWS', { SANITY_FIXTURE_MODE: 'replay' }, 'throws'],
  ['local + replay + dir: loads, fixture active', { SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: DIR }, 'active'],
  ['local + record + confirm + dir: loads, fixture active', { SANITY_FIXTURE_MODE: 'record', SANITY_FIXTURE_RECORD_CONFIRM: '1', SANITY_FIXTURE_DIR: DIR }, 'active'],
  ['nothing set: loads, fixture inactive', {}, 'inactive'],
];
const failures = [];
for (const [name, env, want] of cases) {
  const r = run(env);
  const ok = want === 'throws' ? r.code === 1 && /THREW/.test(r.out) : r.code === 0 && r.out.includes(`active=${want === 'active'}`);
  if (!ok) failures.push(`${name} (exit ${r.code}: ${r.out.slice(0, 160)})`);
}
const guard = readFileSync('lib/fixture-route-guard.ts', 'utf8'); const lib = readFileSync('lib/sanity-fixture.ts', 'utf8');
if (!/K_SERVICE/.test(guard) || !/isHostedRuntime/.test(lib)) failures.push('lib/sanity-fixture.ts must use isHostedRuntime() from fixture-route-guard (K_SERVICE), the repo pattern');
if (failures.length) { console.error(`A16 FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`A16 pass (${cases.length} hosted/local module-load cases)`);
