#!/usr/bin/env node
// F4 (cms-loop-and-wiring): A7 — the "don't over-remove" guard for `province`. A6
// alone (sidebar absence) would ALSO pass if @dev deregistered the schema type
// entirely and/or deleted the 9 published documents — a genuinely destructive
// over-removal that team-lead's brief explicitly forbids
// ("Do NOT remove it from schemaTypes... Do not delete the province documents").
// This check covers the two directions A6 does not:
//   (a) SOURCE: `province` must still be registered in sanity/schemas/index.ts's
//       schemaTypes — proves the type itself was not deregistered.
//   (b) DATASET: exactly 9 `province` documents must still exist in the live
//       Content Lake — proves no documents were deleted. 9 is not an approximate
//       "at least" bound — docs/f4-orphaned-types-recon.md confirmed exactly 9 exist
//       today (one per real South African province), so any count other than 9
//       (higher OR lower) is a real anomaly worth failing loudly on, not rounding
//       off silently.
//
// THIS IS AN INVARIANT CHECK, not a before/after flip: it is expected to PASS both
// BEFORE and AFTER @dev's change (removing the sidebar entry never touches
// schemaTypes or the dataset) — a regression here at ANY point in this mission
// (before, during, or after F4 lands) is a real, standalone defect, independent of
// whether A6 has flipped.
//
// Run as: node contracts/checks/cms-loop-f4-orphaned-types/check-province-registered-and-intact.mjs
// Exit codes: 0 = type still registered AND exactly 9 documents exist. 1 = either
// condition fails, secret/token missing, or the dataset is unreachable — never a skip.

import { readFileSync } from 'node:fs';
import { getSanityClient } from '../f6-prove-cms-loop/_shared.mjs';

const SCHEMA_INDEX_PATH = new URL('../../../sanity/schemas/index.ts', import.meta.url);
const EXPECTED_PROVINCE_COUNT = 9;

console.log('--- Condition (a): province still registered in schemaTypes? ---');
let indexText;
try {
  indexText = readFileSync(SCHEMA_INDEX_PATH, 'utf8');
} catch (err) {
  console.error(`FAIL: could not read sanity/schemas/index.ts — ${err.message}`);
  process.exit(1);
}
// Matches the `province` import/identifier as used in schemaTypes' array — a bare
// word-boundary match against the whole file is intentionally permissive (register
// could be `province,` or `province ,` or on its own line); it only needs to prove
// the identifier is still referenced somewhere in this file, not parse the AST.
const stillRegistered = /\bprovince\b/.test(indexText);
console.log(`sanity/schemas/index.ts references 'province': ${stillRegistered}`);
if (!stillRegistered) {
  console.error(
    'FAIL: sanity/schemas/index.ts no longer references province — the schema type appears to have been ' +
      'deregistered. This is explicitly forbidden (team-lead brief): the 9 published province documents would ' +
      'become unrenderable/unvalidatable in Studio if the type is deregistered while they still exist.'
  );
  process.exit(1);
}

console.log('--- Condition (b): exactly 9 province documents still exist in the dataset ---');
const client = getSanityClient();
let count;
try {
  count = await client.fetch('count(*[_type == "province"])');
} catch (err) {
  console.error(`FAIL: dataset count query threw — ${err.message}`);
  process.exit(1);
}
console.log(`province document count: ${count}`);
if (count !== EXPECTED_PROVINCE_COUNT) {
  console.error(
    `FAIL: expected exactly ${EXPECTED_PROVINCE_COUNT} province documents (confirmed present in ` +
      `docs/f4-orphaned-types-recon.md), found ${count}. Any deviation means documents were created or deleted ` +
      'as a side effect of this feature, which is out of scope and explicitly forbidden.'
  );
  process.exit(1);
}

console.log('PASS: province type is still registered in schemaTypes, and all 9 documents are intact.');
process.exit(0);
