#!/usr/bin/env node
// vendor-stand-early-bird-pricing F1 (A1) -- pure-function proof, no Firestore/harness needed.
// resolveVendorStandPrice(boothSize, now, cutoffIso) selects the early-bird tier strictly
// before the cutoff and the regular tier strictly after, reusing (unmodified)
// lib/checkout-reservation.ts's isWithinEarlyBirdWindow(now, cutoffIso). Also proves the SAST
// boundary correctness: deriveVendorStandEarlyBirdCutoffIso(showStartDate) must produce an ISO
// string carrying an explicit +02:00 offset (not bare UTC), so the last instant qualifying for
// early-bird and the first instant that does not are both exactly 2 hours later than a naive
// UTC-midnight boundary would give -- see contracts/golden/vendor-stand-early-bird-pricing/
// README.md "SAST boundary, in one place".
//
// Run as: node --import tsx/esm contracts/checks/vendor-stand-early-bird-pricing/check-tier-selected-either-side-of-cutoff.mjs

import { readFileSync } from 'node:fs';

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const pricingSource = readFileSync(new URL('../../../lib/vendor-stand-pricing.ts', import.meta.url), 'utf8');
assert(
  /isWithinEarlyBirdWindow/.test(pricingSource) &&
    /from ['"]@?\.?\.?\/?.*checkout-reservation['"]/.test(pricingSource),
  'lib/vendor-stand-pricing.ts imports isWithinEarlyBirdWindow from lib/checkout-reservation.ts rather than reimplementing cutoff-date comparison',
);

let pricing;
try {
  pricing = await import('../../../lib/vendor-stand-pricing.ts');
} catch (error) {
  failures.push(`failed to import lib/vendor-stand-pricing.ts: ${error.message}`);
}

if (pricing) {
  const { resolveVendorStandPrice, deriveVendorStandEarlyBirdCutoffIso } = pricing;

  if (typeof deriveVendorStandEarlyBirdCutoffIso !== 'function') {
    failures.push('lib/vendor-stand-pricing.ts does not export deriveVendorStandEarlyBirdCutoffIso');
  } else {
    // Show opens Thursday 16 September 2027 -- 90 days before is 2027-06-18. The derived ISO
    // string must carry an explicit +02:00 (SAST) offset, never bare UTC/'Z'.
    const showStart = new Date('2027-09-16T00:00:00Z');
    const cutoffIso = deriveVendorStandEarlyBirdCutoffIso(showStart);
    assert(
      typeof cutoffIso === 'string' && /2027-06-18T00:00:00\+02:00$/.test(cutoffIso),
      `deriveVendorStandEarlyBirdCutoffIso(2027-09-16) should derive '...2027-06-18T00:00:00+02:00', got ${JSON.stringify(cutoffIso)}`,
    );

    // Derivation must track a MOVED show date, not a hardcoded value.
    const movedShowStart = new Date('2027-10-01T00:00:00Z');
    const movedCutoffIso = deriveVendorStandEarlyBirdCutoffIso(movedShowStart);
    assert(
      typeof movedCutoffIso === 'string' && /2027-07-03T00:00:00\+02:00$/.test(movedCutoffIso),
      `deriveVendorStandEarlyBirdCutoffIso(2027-10-01) should derive '...2027-07-03T00:00:00+02:00' (90 days before, tracking the moved show date), got ${JSON.stringify(movedCutoffIso)}`,
    );

    if (typeof resolveVendorStandPrice === 'function') {
      try {
        // Boundary: midnight SAST on 19 June 2027 == 2027-06-18T22:00:00Z. The last instant
        // qualifying for early-bird is just before that; the first instant that does not is
        // exactly that instant. A naive UTC-midnight boundary (2027-06-19T00:00:00Z) would be
        // WRONG by 2 hours -- this is exactly what A1 must catch.
        const lastEarlyBirdInstant = new Date('2027-06-18T21:59:59.999Z');
        const firstRegularInstant = new Date('2027-06-18T22:00:00.000Z');

        const beforeResult = resolveVendorStandPrice(1, lastEarlyBirdInstant, cutoffIso);
        assert(
          beforeResult.ok === true && beforeResult.tier === 'earlyBird' && beforeResult.amount === 1160,
          `at the last qualifying instant (2027-06-18T21:59:59.999Z SAST-adjusted), expected {ok:true, tier:'earlyBird', amount:1160}, got ${JSON.stringify(beforeResult)}`,
        );

        const afterResult = resolveVendorStandPrice(1, firstRegularInstant, cutoffIso);
        assert(
          afterResult.ok === true && afterResult.tier === 'regular' && afterResult.amount === 1450,
          `at the first non-qualifying instant (2027-06-18T22:00:00.000Z, midnight SAST 19 June), expected {ok:true, tier:'regular', amount:1450}, got ${JSON.stringify(afterResult)}`,
        );

        // A naive UTC-midnight boundary would wrongly still grant early-bird at 2027-06-18T23:00:00Z
        // (1am SAST on the 19th) -- prove the fix actually rejects that.
        const naiveBoundaryTrap = resolveVendorStandPrice(1, new Date('2027-06-18T23:00:00Z'), cutoffIso);
        assert(
          naiveBoundaryTrap.ok === true && naiveBoundaryTrap.tier === 'regular',
          `at 2027-06-18T23:00:00Z (1am SAST on 19 June, after the SAST-midnight cutoff), a naive UTC-midnight-boundary implementation would still grant early-bird -- expected tier 'regular', got ${JSON.stringify(naiveBoundaryTrap)}`,
        );
      } catch (error) {
        failures.push(`resolveVendorStandPrice(boothSize, now, cutoffIso) threw: ${error.message}`);
      }
    } else {
      failures.push('lib/vendor-stand-pricing.ts does not export resolveVendorStandPrice as a function');
    }
  }
}

if (failures.length > 0) {
  console.log('FAIL — check-tier-selected-either-side-of-cutoff');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('PASS — check-tier-selected-either-side-of-cutoff');
  process.exit(0);
}
