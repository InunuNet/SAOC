// F3 (ticketing-conferences-and-events, M2) — proves every product in the three provisional
// arrays carries the NEW `category` field matching which array it lives in, and that the
// counts are exactly what F1/F2 already established (5 admission + 6 conference + 4
// workshop-field-trip = 15 total ticketType documents). This is the single source of truth
// the Sanity schema field, the category-filtered query, and the migration script (backfilling
// the 15 pre-existing documents) all key off — a drift here silently mis-sorts a real product
// onto the wrong purchase page or off /tickets entirely.
//
// THE DEFECT CLASS THIS TARGETS
// A dev adds the `category` field to the schema/query/pages but forgets to actually SET it on
// one or more of the 15 existing product literals in lib/provisional-figures.ts — the array
// still "looks done" (schema exists, query exists, pages exist) while a real product is
// invisible on every category page (category undefined matches no $category filter) or, worse,
// silently shows up mixed on /tickets again (the exact live bug this feature fixes).
//
// Run as: npx tsx contracts/checks/ticketing-purchase-pages-f3/check-category-assignment.mjs

import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
} from '../../../lib/provisional-figures.ts';

const failures = [];

function expect(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}: expected ${e}, got ${a}`);
}

const GROUPS = [
  { arrayName: 'ADMISSION_PRODUCTS', array: ADMISSION_PRODUCTS, expectedCategory: 'admission', expectedCount: 5 },
  { arrayName: 'CONFERENCE_PRODUCTS', array: CONFERENCE_PRODUCTS, expectedCategory: 'conference', expectedCount: 6 },
  {
    arrayName: 'WORKSHOP_FIELD_TRIP_PRODUCTS',
    array: WORKSHOP_FIELD_TRIP_PRODUCTS,
    expectedCategory: 'workshop-field-trip',
    expectedCount: 4,
  },
];

for (const group of GROUPS) {
  expect(`${group.arrayName} is an array`, Array.isArray(group.array), true);
  expect(`${group.arrayName}.length`, (group.array || []).length, group.expectedCount);
  for (const product of group.array || []) {
    if (product.category !== group.expectedCategory) {
      failures.push(
        `${group.arrayName} entry '${product.slug}': expected category '${group.expectedCategory}', got ${JSON.stringify(product.category)}`
      );
    }
  }
}

// No product silently defaults into the wrong bucket via a shared/undefined value — every
// category value actually present across all three arrays must be exactly the three expected
// strings, never a 4th, never undefined.
const allCategories = new Set(
  [...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS].map((p) => p.category)
);
const EXPECTED_CATEGORIES = new Set(['admission', 'conference', 'workshop-field-trip']);
for (const category of allCategories) {
  if (!EXPECTED_CATEGORIES.has(category)) {
    failures.push(`unexpected category value present in provisional-figures.ts: ${JSON.stringify(category)}`);
  }
}
for (const category of EXPECTED_CATEGORIES) {
  if (!allCategories.has(category)) {
    failures.push(`expected category value missing from every product: ${JSON.stringify(category)}`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-category-assignment.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: all 15 products carry the correct category field, no drift, no 4th value.');
