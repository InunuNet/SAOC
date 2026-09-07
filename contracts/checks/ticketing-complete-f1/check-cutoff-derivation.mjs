#!/usr/bin/env node
// ticketing-complete M1/F1 (A12) -- pure-function proof that
// deriveAdmissionEarlyBirdCutoffIso() derives its 90-day cutoff from the show's own SAST
// calendar date, not the UTC calendar date of the showStartDate instant. Runs every entry in
// goldens/fixtures/f1-pricing-boundary-cases.json's `cutoffDerivationCases` array. See that
// fixture's `_comment` fields for why only 'cutoff-derivation-early-morning-start' is capable
// of catching this bug class -- 'cutoff-derivation-standard-morning-start' is kept only as a
// non-discriminating baseline/sanity case.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-complete-f1/check-cutoff-derivation.mjs

import { readFileSync } from 'node:fs';
import { deriveAdmissionEarlyBirdCutoffIso } from '../../../lib/admission-early-bird-pricing.ts';

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const fixturePath = new URL(
  '../../../.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f1-pricing-boundary-cases.json',
  import.meta.url,
);
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

assert(
  Array.isArray(fixture.cutoffDerivationCases) && fixture.cutoffDerivationCases.length > 0,
  'fixture f1-pricing-boundary-cases.json has no cutoffDerivationCases array to verify against',
);

for (const testCase of fixture.cutoffDerivationCases ?? []) {
  const showStartDate = new Date(testCase.showStartDateIso);
  let actual;
  try {
    actual = deriveAdmissionEarlyBirdCutoffIso(showStartDate);
  } catch (error) {
    failures.push(`case '${testCase.id}': deriveAdmissionEarlyBirdCutoffIso threw: ${error.message}`);
    continue;
  }
  assert(
    actual === testCase.expectedCutoffIso,
    `case '${testCase.id}': expected cutoff ${testCase.expectedCutoffIso}, got ${actual} (show start ${testCase.showStartDateIso})`,
  );
}

if (failures.length > 0) {
  console.log('FAIL — check-cutoff-derivation');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('PASS — check-cutoff-derivation');
  process.exit(0);
}
