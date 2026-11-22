// Negative control for the route-runner runtime guard. Run WITHOUT preload.cjs, and with the old
// environment variable set, every module a check can import from contracts/harness/route-runner/
// must refuse to load. The guard throws from require-preload.mjs, the first import of each
// module, so no fixture body, route or Firebase code is evaluated. Assertions look only at the
// thrown error.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.SAOC_ROUTE_RUNNER_PRELOAD = '1';

const HARNESS = join(dirname(fileURLToPath(import.meta.url)), '../../../../harness/route-runner');
const ENTRY_MODULES = readdirSync(HARNESS).filter(
  (name) => name === 'store.mjs' || /^fixture-.*\.mjs$/.test(name),
);
const REFUSAL = /preload\.cjs is not loaded/;

if (ENTRY_MODULES.length === 0) {
  console.error('FAIL: no harness entry modules found; the directory layout changed');
  process.exit(1);
}

const failures = [];
for (const name of ENTRY_MODULES) {
  try {
    await import(pathToFileURL(join(HARNESS, name)).href);
    failures.push(`${name}: loaded without the preload`);
  } catch (err) {
    if (!REFUSAL.test(String(err && err.message))) {
      failures.push(`${name}: threw the wrong error: ${String(err && err.message).slice(0, 80)}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`PASS: all ${ENTRY_MODULES.length} harness entry modules refuse to load without the preload`);
