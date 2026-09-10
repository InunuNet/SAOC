#!/usr/bin/env node
// A8 — style-freeze guard: navigation (components/chrome/**) is the ONE sanctioned
// exception to the main-site style freeze for mission ticketing-complete M3/F6.
// Every file listed in ../../../.agent/memory/project/specs/ticketing-complete/
// goldens/fixtures/f6-style-freeze-baseline.json (app/globals.css plus six
// representative page components) must be byte-identical to its pre-F6 baseline.
//
// Mirrors contracts/checks/vendor-f3-showcase-page/check-untouched-scope.mjs
// deliberately — same sha256-comparison pattern, different scope — so this is
// unaffected by other in-flight features editing unrelated files in the same
// working tree tonight.
//
// DEFEATING MUTATION: any edit to app/globals.css or the six baselined page
// components while implementing F6 — including a "just one token for the nav"
// addition, an added import, or reformatting.
//
// Run as: node contracts/checks/ticketing-complete-f6/check-style-freeze.mjs
// (no TypeScript import needed — this only reads file bytes, so plain `node` is
// fine here.)

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const baselinePath = new URL(
  '../../../.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f6-style-freeze-baseline.json',
  import.meta.url,
);
const { files: baseline } = JSON.parse(readFileSync(baselinePath, 'utf8'));

const failures = [];

for (const [relPath, expectedHash] of Object.entries(baseline)) {
  const fullPath = `${repoRoot}${relPath}`;
  let actualHash;
  try {
    actualHash = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
  } catch (error) {
    failures.push(`could not read ${relPath}: ${error.message}`);
    continue;
  }
  if (actualHash !== expectedHash) {
    failures.push(
      `${relPath} changed since the F6 style-freeze baseline (expected sha256 ${expectedHash}, ` +
        `got ${actualHash}) — this file is outside F6's sanctioned scope (nav only); revert ` +
        `unrelated style edits`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: globals.css and the six baselined page components are unchanged from the pre-F6 style-freeze baseline.');
process.exit(0);
