// F1 (conference-workshop-tickets, M1) — A6: computeEarlyBirdRemaining matches every
// fixture case in goldens/f1-early-bird-remaining-cases.json, including the never-negative
// clamp and the null-pool passthrough. Reads the golden fixtures file directly (rather than
// hardcoding a second copy of the cases here) so the two can never silently drift apart.
//
// Run as: node contracts/checks/conference-workshop-tickets-f1/check-early-bird-remaining-fixtures.mjs
// (also runs under `npx tsx` directly). Registers tsx's ESM loader programmatically — rather
// than relying on a `--import tsx/esm` CLI flag the contract's own `command:` string does not
// pass — so a plain `node <this file>` invocation can still resolve the target's `.ts`
// imports.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { register } from 'tsx/esm/api';

register();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { computeEarlyBirdRemaining } = await import(
  path.join(__dirname, '../../../lib/checkout-reservation.ts')
);
const GOLDEN_PATH = path.join(
  __dirname,
  '../../../.agent/memory/project/specs/conference-workshop-tickets/goldens/f1-early-bird-remaining-cases.json',
);

const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
const failures = [];

if (!Array.isArray(golden.cases) || golden.cases.length === 0) {
  console.error('FAIL: check-early-bird-remaining-fixtures.mjs');
  console.error(`  - no cases found in golden fixture file ${GOLDEN_PATH}`);
  process.exit(1);
}

for (const testCase of golden.cases) {
  // The golden's field is `trancheSize` (the historical name from the superseded tranche
  // design) — the function's own parameter is the generic `poolSize`. Same value, different
  // name on each side of the boundary; see the function's own doc comment.
  const poolSize = testCase.trancheSize;
  const soldCount = testCase.soldCount;
  const expected = testCase.expected;

  let actual;
  try {
    actual = computeEarlyBirdRemaining(poolSize, soldCount);
  } catch (err) {
    failures.push(`case '${testCase.name}': threw ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }

  if (actual !== expected) {
    failures.push(
      `case '${testCase.name}': computeEarlyBirdRemaining(${JSON.stringify(poolSize)}, ${JSON.stringify(soldCount)}) ` +
        `= ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );
  }
}

// Explicit undefined-tranche case, mirroring the golden's "tranche unset (undefined) behaves
// identically to null" fixture — calling with an actual `undefined` argument, not a
// JSON-serialisable null, since JSON itself cannot represent `undefined`.
const undefinedCase = computeEarlyBirdRemaining(undefined, 0);
if (undefinedCase !== null) {
  failures.push(`computeEarlyBirdRemaining(undefined, 0) = ${JSON.stringify(undefinedCase)}, expected null`);
}

if (failures.length > 0) {
  console.error('FAIL: check-early-bird-remaining-fixtures.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS: computeEarlyBirdRemaining matches all ${golden.cases.length} golden fixture cases.`);
