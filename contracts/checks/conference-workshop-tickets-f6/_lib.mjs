// Shared loader for this feature's (F6, conference-workshop-tickets M4) check scripts.
// Factors out the tsx/esm registration + relative-import boilerplate every check-*.mjs in
// this directory needs — see conference-workshop-tickets-f1's
// check-symposium-wosa-figures.mjs for why `register()` is called programmatically rather
// than relying on a loader flag (these scripts run as plain `node`, not `npx tsx`).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { register } from 'tsx/esm/api';

register();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Imports a repo module by its path relative to the repo root (e.g. 'lib/provisional-figures.ts'). */
export async function loadRepoModule(relPath) {
  return import(path.join(__dirname, '../../../', relPath));
}

/** Prints FAIL + bullet list and exits 1 if `failures` is non-empty; otherwise prints PASS. */
export function finish(scriptName, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${scriptName}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
