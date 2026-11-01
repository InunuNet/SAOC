// Golden mutant runner. Usage: node run-mutants.mjs <mutants.json> <patches.json>
// patches.json (written by the dev, committed beside the probe pack) maps mutant id -> {file, find, replace}
// against the real source. Every mutant is applied to a sandbox copy; `--selftest` must exit nonzero.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , mutantsPath, patchesPath] = process.argv;
const ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..', '..');
const EXPECTATIONS_DIR = '.agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens';
const SANDBOX = resolve(ROOT, '.tmp/sandbox/go-live-mutants');
const mutants = JSON.parse(readFileSync(mutantsPath, 'utf8')).mutants;
const patches = JSON.parse(readFileSync(patchesPath, 'utf8'));
let survived = 0;
for (const mutant of mutants) {
  rmSync(SANDBOX, { recursive: true, force: true });
  mkdirSync(resolve(SANDBOX, 'scripts/checks'), { recursive: true });
  cpSync(resolve(ROOT, 'scripts/checks/lib'), resolve(SANDBOX, 'scripts/checks/lib'), { recursive: true });
  cpSync(resolve(ROOT, 'scripts/checks/cache-headers-probe.mjs'), resolve(SANDBOX, 'scripts/checks/cache-headers-probe.mjs'));
  mkdirSync(resolve(SANDBOX, 'lib'), { recursive: true });
  cpSync(resolve(ROOT, 'lib/ticketing-test-mode.ts'), resolve(SANDBOX, 'lib/ticketing-test-mode.ts'));
  mkdirSync(resolve(SANDBOX, EXPECTATIONS_DIR), { recursive: true });
  cpSync(resolve(ROOT, EXPECTATIONS_DIR, 'cache-header-expectations.json'), resolve(SANDBOX, EXPECTATIONS_DIR, 'cache-header-expectations.json'));
  const patch = patches[mutant.id];
  if (!patch) { console.log(`MISSING ${mutant.id} has no patch`); survived += 1; continue; }
  const file = resolve(SANDBOX, patch.file);
  const source = readFileSync(file, 'utf8');
  if (!new RegExp(patch.find).test(source)) { console.log(`MISSING ${mutant.id} pattern not found`); survived += 1; continue; }
  writeFileSync(file, source.replace(new RegExp(patch.find), patch.replace));
  const run = spawnSync('node', [resolve(SANDBOX, 'scripts/checks/cache-headers-probe.mjs'), '--selftest'], { encoding: 'utf8' });
  const killed = run.status !== 0;
  if (!killed) survived += 1;
  console.log(`${killed ? 'KILLED' : 'SURVIVED'} ${mutant.id} ${mutant.intent}`);
}
rmSync(SANDBOX, { recursive: true, force: true });
process.exit(survived === 0 ? 0 : 1);
