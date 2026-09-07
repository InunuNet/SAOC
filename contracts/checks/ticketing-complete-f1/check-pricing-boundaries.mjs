#!/usr/bin/env node
// ticketing-complete M1/F1 (A5/A6) -- pure-function boundary proof for
// resolveComputedEarlyBirdPrice(), matching the golden truth table in
// .agent/memory/project/specs/ticketing-complete/goldens/fixtures/f1-pricing-boundary-cases.json
// and its negative-control companion f1-broken-naive-utc-fixture.json.
//
// Run as:
//   node --import tsx/esm contracts/checks/ticketing-complete-f1/check-pricing-boundaries.mjs
//   node --import tsx/esm contracts/checks/ticketing-complete-f1/check-pricing-boundaries.mjs --negative-control

import { readFileSync } from 'node:fs';
import { isWithinEarlyBirdWindow } from '../../../lib/checkout-reservation.ts';

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const negativeControl = process.argv.includes('--negative-control');

const goldensDir = new URL(
  '../../../.agent/memory/project/specs/ticketing-complete/goldens/fixtures/',
  import.meta.url,
);

if (!negativeControl) {
  // --- A5: positive boundary proof against the golden truth table. ---
  const { resolveComputedEarlyBirdPrice, deriveAdmissionEarlyBirdCutoffIso } = await import(
    '../../../lib/admission-early-bird-pricing.ts'
  );

  const fixture = JSON.parse(readFileSync(new URL('f1-pricing-boundary-cases.json', goldensDir), 'utf8'));
  const showStartDate = new Date(fixture.showStartDateIso);

  const actualCutoffIso = deriveAdmissionEarlyBirdCutoffIso(showStartDate);
  assert(
    actualCutoffIso === fixture.expectedCutoffIso,
    `deriveAdmissionEarlyBirdCutoffIso mismatch: expected ${fixture.expectedCutoffIso}, got ${actualCutoffIso}`,
  );

  for (const testCase of fixture.cases) {
    const purchaseDate = new Date(testCase.purchaseDateIso);
    let result;
    try {
      result = resolveComputedEarlyBirdPrice({
        basePrice: testCase.basePrice,
        purchaseDate,
        showStartDate,
      });
    } catch (error) {
      failures.push(`case '${testCase.id}': resolveComputedEarlyBirdPrice threw: ${error.message}`);
      continue;
    }
    assert(
      result.tier === testCase.expectedTier,
      `case '${testCase.id}': expected tier '${testCase.expectedTier}', got '${result.tier}' (${testCase.note})`,
    );
    assert(
      result.amount === testCase.expectedAmount,
      `case '${testCase.id}': expected amount ${testCase.expectedAmount}, got ${result.amount} (${testCase.note})`,
    );
  }

  // Note: the SAST-vs-UTC calendar-day discrimination for deriveAdmissionEarlyBirdCutoffIso
  // itself now lives in A12 (check-cutoff-derivation.mjs), driven by the fixture's
  // `cutoffDerivationCases` array -- this script previously carried an ad-hoc inline case for
  // that before A12 existed; removed in favour of the real golden-fixture-backed version.
} else {
  // --- A6: negative control. Simulates the deliberately-broken bare-UTC cutoff variant
  // described in f1-broken-naive-utc-fixture.json (treats the cutoff ISO string as bare UTC
  // instead of respecting its +02:00 offset) and asserts it DISAGREES with the correct
  // implementation at the documented disagreement instant -- proving the A5 boundary test is
  // actually discriminating, not vacuously true. ---
  const { resolveComputedEarlyBirdPrice } = await import('../../../lib/admission-early-bird-pricing.ts');

  const fixture = JSON.parse(readFileSync(new URL('f1-broken-naive-utc-fixture.json', goldensDir), 'utf8'));
  const showStartDate = new Date(fixture.showStartDateIso);
  const disagreement = fixture.disagreementCase;
  const purchaseDate = new Date(disagreement.purchaseDateIso);

  const correctResult = resolveComputedEarlyBirdPrice({
    basePrice: 130,
    purchaseDate,
    showStartDate,
  });
  assert(
    correctResult.tier === disagreement.correctExpectedTier,
    `correct implementation: expected tier '${disagreement.correctExpectedTier}' at ${disagreement.purchaseDateIso}, got '${correctResult.tier}'`,
  );

  // The broken naive-UTC variant: same isWithinEarlyBirdWindow comparator (reused, not
  // reimplemented), but fed the bare-UTC cutoff instead of the correct +02:00 one.
  const brokenWithinWindow = isWithinEarlyBirdWindow(purchaseDate, fixture.brokenNaiveCutoffIso);
  const brokenTier = brokenWithinWindow ? 'earlyBird' : 'regular';
  assert(
    brokenTier === disagreement.brokenNaiveExpectedTier,
    `broken naive-UTC simulation: expected tier '${disagreement.brokenNaiveExpectedTier}' at ${disagreement.purchaseDateIso}, got '${brokenTier}'`,
  );

  assert(
    correctResult.tier !== brokenTier,
    `NEGATIVE CONTROL FAILED TO DISCRIMINATE: correct ('${correctResult.tier}') and broken naive-UTC ('${brokenTier}') implementations agree at ${disagreement.purchaseDateIso} -- the A5 boundary test cannot actually tell them apart`,
  );
}

if (failures.length > 0) {
  console.log(`FAIL — check-pricing-boundaries${negativeControl ? ' --negative-control' : ''}`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log(`PASS — check-pricing-boundaries${negativeControl ? ' --negative-control' : ''}`);
  process.exit(0);
}
