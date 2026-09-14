// F2 (ticketing-complete, M1) — proves Brad's VIP ruling (2026-09-08: R625 regular, 20%
// early-bird discount applies, computing to R500) is exercised by the REAL, contract-locked
// computed pricing engine (lib/admission-early-bird-pricing.ts, F1 of this mission — NOT
// modified here, only imported and called) rather than assumed arithmetic. F1's whole point
// is that the discount is COMPUTED, not stored twice by hand — this check is what makes that
// true for VIP specifically, not just documented as true.
//
// THE PROPERTY THIS PROVES
// resolveComputedEarlyBirdPrice({ basePrice: 625, purchaseDate: <inside the real 90-day
// window>, showStartDate: <the real live show-19-2027 start> }) must return
// { amount: 500, tier: 'earlyBird' }, and the same basePrice with a purchaseDate just outside
// the window must return { amount: 625, tier: 'regular' }. Uses the EXACT real show start
// instant from goldens/fixtures/f1-pricing-boundary-cases.json
// (showStartDateIso: '2027-09-16T07:00:00Z', i.e. 2027-09-16T09:00:00+02:00) and boundary
// instants from that same fixture's own cases, rather than inventing new dates — this is the
// real cutoff (2027-06-18T00:00:00+02:00), not a stand-in.
//
// Also sanity-checks the ladder ordering Brad's ruling was meant to fix: VIP's regular price
// (625) sits above Weekend Pass's regular price (400), and VIP's early-bird price (500)
// still sits above BOTH Weekend Pass SKUs (380 early-bird / 400 regular) — reading the real
// values from lib/provisional-figures.ts, not hardcoded twice.
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-vip-computed-early-bird-price.mjs

import { resolveComputedEarlyBirdPrice } from '../../../lib/admission-early-bird-pricing.ts';
import { ADMISSION_PRODUCTS } from '../../../lib/provisional-figures.ts';

const failures = [];

const vip = ADMISSION_PRODUCTS.find((p) => p.slug === 'vip');
if (!vip) {
  console.error('FAIL: check-vip-computed-early-bird-price.mjs');
  console.error("  - no 'vip' entry in ADMISSION_PRODUCTS");
  process.exit(1);
}

// The real live show-19-2027 start instant, matching
// goldens/fixtures/f1-pricing-boundary-cases.json's showStartDateIso verbatim.
const SHOW_START_DATE = new Date('2027-09-16T07:00:00Z');

// Two of the SAME boundary instants that fixture already golden-tests against the engine
// for other products (early-bird admission ticket) — reused here for VIP specifically.
const INSIDE_WINDOW_PURCHASE_DATE = new Date('2027-06-18T00:00:00+02:00'); // exactly on cutoff
const OUTSIDE_WINDOW_PURCHASE_DATE = new Date('2027-06-19T08:00:00+02:00'); // one day past cutoff

if (typeof vip.regularPrice !== 'number') {
  failures.push(`vip.regularPrice is ${JSON.stringify(vip.regularPrice)} — expected a number (625)`);
} else {
  const insideResult = resolveComputedEarlyBirdPrice({
    basePrice: vip.regularPrice,
    purchaseDate: INSIDE_WINDOW_PURCHASE_DATE,
    showStartDate: SHOW_START_DATE,
  });
  if (insideResult.amount !== 500 || insideResult.tier !== 'earlyBird') {
    failures.push(
      `inside-window: resolveComputedEarlyBirdPrice(basePrice=${vip.regularPrice}) returned ` +
        `${JSON.stringify(insideResult)}, expected { amount: 500, tier: 'earlyBird' }`
    );
  }

  const outsideResult = resolveComputedEarlyBirdPrice({
    basePrice: vip.regularPrice,
    purchaseDate: OUTSIDE_WINDOW_PURCHASE_DATE,
    showStartDate: SHOW_START_DATE,
  });
  if (outsideResult.amount !== 625 || outsideResult.tier !== 'regular') {
    failures.push(
      `outside-window: resolveComputedEarlyBirdPrice(basePrice=${vip.regularPrice}) returned ` +
        `${JSON.stringify(outsideResult)}, expected { amount: 625, tier: 'regular' }`
    );
  }
}

// vip.price is the STORED early-bird price this file's other consumers (the live /tickets
// page today) read directly — it must agree with what the COMPUTED engine independently
// derives from regularPrice, or the two pricing models have silently diverged.
if (vip.price !== 500) {
  failures.push(`vip.price (stored early-bird price) is ${vip.price}, expected 500 to match the computed engine's result`);
}

// Ladder ordering sanity check (Brad's stated reason for the ruling): VIP now sits above
// Weekend Pass in both tiers.
const weekendPass = ADMISSION_PRODUCTS.find((p) => p.slug === 'weekend-pass');
if (!weekendPass) {
  failures.push("no 'weekend-pass' entry in ADMISSION_PRODUCTS to compare against");
} else {
  if (!(vip.regularPrice > weekendPass.regularPrice)) {
    failures.push(
      `VIP regular (${vip.regularPrice}) does not sit above Weekend Pass regular ` +
        `(${weekendPass.regularPrice}) — the ladder is still incoherent`
    );
  }
  if (!(vip.price > weekendPass.price)) {
    failures.push(
      `VIP early-bird (${vip.price}) does not sit above Weekend Pass early-bird ` +
        `(${weekendPass.price}) — the ladder is still incoherent`
    );
  }
  if (!(vip.price > weekendPass.regularPrice)) {
    failures.push(
      `VIP early-bird (${vip.price}) does not sit above Weekend Pass regular ` +
        `(${weekendPass.regularPrice}) — the ladder is still incoherent`
    );
  }
}

// Settled figures are never mislabelled as pending council confirmation.
if (vip.provisional !== false) {
  failures.push(`vip.provisional is ${JSON.stringify(vip.provisional)}, expected false — this is a settled ruling, not a guess`);
}
if (!vip.sourceCitation || !/brad/i.test(vip.sourceCitation)) {
  failures.push(`vip.sourceCitation is ${JSON.stringify(vip.sourceCitation)} — expected it to cite Brad's ruling`);
}

if (failures.length > 0) {
  console.error('FAIL: check-vip-computed-early-bird-price.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  "PASS: VIP's R625/R500 pricing is exercised by the real computed early-bird engine, the " +
    'stored figures agree with it, the ladder ordering is coherent, and the figure is ' +
    "correctly marked settled (not provisional) with Brad's ruling cited."
);
