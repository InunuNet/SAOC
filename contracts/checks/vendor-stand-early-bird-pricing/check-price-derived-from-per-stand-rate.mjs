#!/usr/bin/env node
// vendor-stand-early-bird-pricing F1 (A2-price) -- pure-function proof, no Firestore/harness
// needed. Confirmed by Brad: R1450 per stand (standard tier), early-bird 20% less. A booth of
// size N is N stands -- price MUST be N x the confirmed per-stand rate, never six
// independently-maintained numbers (drift risk). Early-bird MUST be exactly 80% of standard,
// computed once via integer cents (not stored as a second independent figure, not computed via
// float division in the payment path). See
// contracts/golden/vendor-stand-early-bird-pricing/README.md "Single confirmed per-stand
// rate, derived multiples".
//
// Run as: node --import tsx/esm contracts/checks/vendor-stand-early-bird-pricing/check-price-derived-from-per-stand-rate.mjs

import { readFileSync } from 'node:fs';

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const pricingSource = readFileSync(new URL('../../../lib/vendor-stand-pricing.ts', import.meta.url), 'utf8');

// Static: exactly ONE confirmed per-stand rate constant, expressed in integer cents (145000 =
// R1450.00), not six independent price constants and not a float rand literal (1450.00) in the
// arithmetic path.
assert(
  /145000/.test(pricingSource),
  'lib/vendor-stand-pricing.ts does not contain the confirmed per-stand rate in integer cents (145000 = R1450.00)',
);
assert(
  !/Math\.round\([^)]*\/\s*100\s*\)\s*\*\s*100/.test(pricingSource),
  'pricing arithmetic looks like it round-trips through a float rand amount instead of staying in integer cents throughout',
);

let pricing;
try {
  pricing = await import('../../../lib/vendor-stand-pricing.ts');
} catch (error) {
  failures.push(`failed to import lib/vendor-stand-pricing.ts: ${error.message}`);
}

if (pricing && typeof pricing.resolveVendorStandPrice === 'function') {
  const { resolveVendorStandPrice, deriveVendorStandEarlyBirdCutoffIso } = pricing;

  try {
    const cutoffIso =
      typeof deriveVendorStandEarlyBirdCutoffIso === 'function'
        ? deriveVendorStandEarlyBirdCutoffIso(new Date('2027-09-16T00:00:00Z'))
        : '2027-06-18T00:00:00+02:00'; // fallback fixture if the derive helper isn't shipped yet

    const wellBeforeCutoff = new Date('2027-01-01T00:00:00Z');
    const wellAfterCutoff = new Date('2027-08-01T00:00:00Z');

    const expectedStandard = { 1: 1450, 2: 2900, 3: 4350 };
    const expectedEarlyBird = { 1: 1160, 2: 2320, 3: 3480 };

    for (const boothSize of [1, 2, 3]) {
      const standardResult = resolveVendorStandPrice(boothSize, wellAfterCutoff, cutoffIso);
      assert(
        standardResult.ok === true &&
          standardResult.tier === 'regular' &&
          standardResult.amount === expectedStandard[boothSize],
        `booth size ${boothSize}, regular tier: expected amount ${expectedStandard[boothSize]} (= R1450 x ${boothSize}), got ${JSON.stringify(standardResult)}`,
      );

      const earlyBirdResult = resolveVendorStandPrice(boothSize, wellBeforeCutoff, cutoffIso);
      assert(
        earlyBirdResult.ok === true &&
          earlyBirdResult.tier === 'earlyBird' &&
          earlyBirdResult.amount === expectedEarlyBird[boothSize],
        `booth size ${boothSize}, early-bird tier: expected amount ${expectedEarlyBird[boothSize]} (= 80% of ${expectedStandard[boothSize]}), got ${JSON.stringify(earlyBirdResult)}`,
      );

      if (standardResult.ok && earlyBirdResult.ok) {
        assert(
          earlyBirdResult.amount * 100 === standardResult.amount * 80,
          `booth size ${boothSize}: early-bird amount must be EXACTLY 80% of the standard amount (integer cents check: earlyBird*100 === standard*80) -- earlyBird=${earlyBirdResult.amount}, standard=${standardResult.amount}`,
        );
      }

      if (boothSize > 1 && standardResult.ok) {
        const singleStandard = resolveVendorStandPrice(1, wellAfterCutoff, cutoffIso);
        assert(
          singleStandard.ok === true && standardResult.amount === singleStandard.amount * boothSize,
          `booth size ${boothSize} standard price must be exactly ${boothSize}x the single-stand rate -- single=${singleStandard.ok ? singleStandard.amount : 'N/A'}, size-${boothSize}=${standardResult.amount}`,
        );
      }
    }
  } catch (error) {
    failures.push(`resolveVendorStandPrice(boothSize, now, cutoffIso) threw: ${error.message}`);
  }
} else if (pricing) {
  failures.push('lib/vendor-stand-pricing.ts does not export resolveVendorStandPrice as a function');
}

if (failures.length > 0) {
  console.log('FAIL — check-price-derived-from-per-stand-rate');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('PASS — check-price-derived-from-per-stand-rate');
  process.exit(0);
}
