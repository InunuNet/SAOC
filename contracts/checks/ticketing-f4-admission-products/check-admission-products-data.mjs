// A8 — lib/provisional-figures.ts's ADMISSION_PRODUCTS must contain EXACTLY the five products
// from provisional-figures.md's own tables (no invented sixth — see golden README "Child ticket:
// OUT of scope for F4, explicitly"), with the right price/capacity/releasedQuantity/
// earlyBirdCutoff per row, and — the part most likely to be gotten backwards — requiresDaySelection
// true ONLY for day-visitor and requiresAttendeeNames true ONLY for vip (mission brief: "Day
// Visitor needs day selection; VIP needs attendee names"; swapping these onto the wrong product
// would compile and run without error, so nothing but a data check catches it).
//
// This check imports a module that does not exist on the current tree — expected to fail with a
// module-resolution error until @dev adds lib/provisional-figures.ts per this contract's brief.
//
// Run as: npx tsx contracts/checks/ticketing-f4-admission-products/check-admission-products-data.mjs

import { ADMISSION_PRODUCTS } from '../../../lib/provisional-figures.ts';

const failures = [];

const EXPECTED = {
  'early-bird': {
    price: 130,
    capacity: 400,
    releasedQuantity: 400,
    earlyBirdCutoff: '2027-07-31',
    requiresDaySelection: false,
    requiresAttendeeNames: false,
  },
  'day-visitor': {
    price: 150,
    capacity: 800,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: true,
    requiresAttendeeNames: false,
  },
  'early-bird-weekend-pass': {
    price: 380,
    capacity: 150,
    releasedQuantity: 150,
    earlyBirdCutoff: '2027-07-31',
    requiresDaySelection: false,
    requiresAttendeeNames: false,
  },
  'weekend-pass': {
    price: 400,
    capacity: 300,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
  },
  vip: {
    price: 300,
    capacity: 120,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
  },
};

if (!Array.isArray(ADMISSION_PRODUCTS)) {
  failures.push(`ADMISSION_PRODUCTS is not an array: ${JSON.stringify(ADMISSION_PRODUCTS)}`);
} else {
  // (1) Exactly five products — no invented sixth (child ticket), none dropped.
  const slugs = ADMISSION_PRODUCTS.map((p) => p.slug).sort();
  const expectedSlugs = Object.keys(EXPECTED).sort();
  if (JSON.stringify(slugs) !== JSON.stringify(expectedSlugs)) {
    failures.push(
      `(1) ADMISSION_PRODUCTS slugs must be exactly ${JSON.stringify(expectedSlugs)}, got ${JSON.stringify(slugs)}. ` +
        `A child ticket must NOT appear here (out of scope for F4 — see golden README).`
    );
  }

  // (2) Every product carries provisional: true (literal, per this file's stage).
  for (const product of ADMISSION_PRODUCTS) {
    if (product.provisional !== true) {
      failures.push(`(2) ${product.slug}: provisional must be true, got ${JSON.stringify(product.provisional)}`);
    }
  }

  // (3) Field-by-field match per product.
  for (const [slug, expected] of Object.entries(EXPECTED)) {
    const product = ADMISSION_PRODUCTS.find((p) => p.slug === slug);
    if (!product) {
      failures.push(`(3) missing product with slug '${slug}'`);
      continue;
    }
    for (const [field, expectedValue] of Object.entries(expected)) {
      const actualValue = product[field];
      if (actualValue !== expectedValue) {
        failures.push(
          `(3) ${slug}.${field}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
        );
      }
    }
  }

  // (4) CORE DEFECT: requiresDaySelection/requiresAttendeeNames must not be swapped or leaked
  // onto the wrong product — assert the true/false partition directly, not just per-row equality
  // above, so a swap-both-onto-the-same-product mutation is also caught.
  const daySelectionSlugs = ADMISSION_PRODUCTS.filter((p) => p.requiresDaySelection === true).map((p) => p.slug);
  if (JSON.stringify(daySelectionSlugs) !== JSON.stringify(['day-visitor'])) {
    failures.push(
      `(4) requiresDaySelection must be true for EXACTLY ['day-visitor'], got ${JSON.stringify(daySelectionSlugs)}`
    );
  }
  const attendeeNamesSlugs = ADMISSION_PRODUCTS.filter((p) => p.requiresAttendeeNames === true).map((p) => p.slug);
  if (JSON.stringify(attendeeNamesSlugs) !== JSON.stringify(['vip'])) {
    failures.push(
      `(4) requiresAttendeeNames must be true for EXACTLY ['vip'], got ${JSON.stringify(attendeeNamesSlugs)}`
    );
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: ADMISSION_PRODUCTS contains exactly the five council products with correct flags.');
