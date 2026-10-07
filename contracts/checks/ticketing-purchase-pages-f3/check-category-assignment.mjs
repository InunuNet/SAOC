// F3 (ticketing-conferences-and-events, M2) — proves every product in the three provisional
// arrays carries the NEW `category` field matching which array it lives in. This is the
// single source of truth the Sanity schema field, the category-filtered query, and the
// migration script (backfilling pre-existing documents) all key off — a drift here silently
// mis-sorts a real product onto the wrong purchase page or off /tickets entirely.
//
// THE DEFECT CLASS THIS TARGETS
// A dev adds the `category` field to the schema/query/pages but forgets to actually SET it on
// one or more of the existing product literals in lib/provisional-figures.ts — the array
// still "looks done" (schema exists, query exists, pages exist) while a real product is
// invisible on every category page (category undefined matches no $category filter) or, worse,
// silently shows up mixed on /tickets again (the exact live bug this feature fixes).
//
// COUNT-CHECK DEFECT REPAIR (Codex GPT-5.5 cross-model review, conference-workshop-tickets
// M1/F1, 2026-10-07): this check originally hardcoded a point-in-time snapshot count per
// group (5/6/4) — a number that goes stale the moment a feature legitimately retires or adds
// a product (conference-workshop-tickets F1 dropped CONFERENCE_PRODUCTS from 6 to 2 the
// SAME way an earlier, never-reconciled retirement had already dropped ADMISSION_PRODUCTS to
// 4 and WORKSHOP_FIELD_TRIP_PRODUCTS to 3 — this check was already red for those two before
// F1 touched anything). A hardcoded total cannot distinguish "a product was legitimately
// retired" from "a product silently vanished" — only the array's own membership can. So this
// now derives its invariants from the live arrays and each category's `RETIRED_*_SLUGS` list
// instead of a fixed snapshot: no duplicate slug within an array (catches a product silently
// doubling or a copy-paste miss), no retired slug resurrected into the live array (catches a
// product coming BACK without anyone noticing), and — unchanged, already count-independent —
// every entry's `category` matches the array it lives in, and no 4th category value exists
// anywhere. It stays failable on exactly the defects that matter; it no longer fails just
// because a feature did its retirement bookkeeping correctly.
//
// Run as: npx tsx contracts/checks/ticketing-purchase-pages-f3/check-category-assignment.mjs

import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
  RETIRED_CONFERENCE_SLUGS,
  RETIRED_FIELD_TRIP_SLUGS,
} from '../../../lib/provisional-figures.ts';

const failures = [];

function expect(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}: expected ${e}, got ${a}`);
}

const GROUPS = [
  { arrayName: 'ADMISSION_PRODUCTS', array: ADMISSION_PRODUCTS, expectedCategory: 'admission', retiredSlugs: [] },
  {
    arrayName: 'CONFERENCE_PRODUCTS',
    array: CONFERENCE_PRODUCTS,
    expectedCategory: 'conference',
    retiredSlugs: RETIRED_CONFERENCE_SLUGS ?? [],
  },
  {
    arrayName: 'WORKSHOP_FIELD_TRIP_PRODUCTS',
    array: WORKSHOP_FIELD_TRIP_PRODUCTS,
    expectedCategory: 'workshop-field-trip',
    retiredSlugs: RETIRED_FIELD_TRIP_SLUGS ?? [],
  },
];

for (const group of GROUPS) {
  expect(`${group.arrayName} is an array`, Array.isArray(group.array), true);
  const array = group.array || [];
  if (array.length === 0) {
    failures.push(`${group.arrayName} is empty — expected at least one live product`);
  }

  const slugs = array.map((p) => p.slug);
  const duplicateSlugs = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
  if (duplicateSlugs.length > 0) {
    failures.push(`${group.arrayName}: duplicate slug(s) ${JSON.stringify([...new Set(duplicateSlugs)])}`);
  }

  const resurrected = group.retiredSlugs.filter((slug) => slugs.includes(slug));
  if (resurrected.length > 0) {
    failures.push(
      `${group.arrayName}: retired slug(s) resurrected into the live array: ${JSON.stringify(resurrected)}`
    );
  }

  for (const product of array) {
    if (product.category !== group.expectedCategory) {
      failures.push(
        `${group.arrayName} entry '${product.slug}': expected category '${group.expectedCategory}', got ${JSON.stringify(product.category)}`
      );
    }
  }
}

// Codex GPT-5.5 cross-model review follow-up (2026-10-07): the per-group duplicate check
// above only catches a slug doubling WITHIN one array — it would miss the same slug living
// in two different arrays (e.g. accidentally copied into both CONFERENCE_PRODUCTS and
// WORKSHOP_FIELD_TRIP_PRODUCTS). The seed path writes every product to `ticketType-${slug}`
// (see scripts/seed-ticketing.ts), so a cross-array duplicate silently collides on the same
// Sanity document id — one product's seed write clobbers the other's. Checked over the union
// of all three live arrays, independent of the per-group loop above.
const slugOccurrences = new Map();
for (const group of GROUPS) {
  for (const product of group.array || []) {
    const occurrences = slugOccurrences.get(product.slug) ?? [];
    occurrences.push(group.arrayName);
    slugOccurrences.set(product.slug, occurrences);
  }
}
for (const [slug, arrayNames] of slugOccurrences) {
  const distinctArrays = new Set(arrayNames);
  if (distinctArrays.size > 1) {
    failures.push(
      `slug '${slug}' is present in more than one array (${JSON.stringify([...distinctArrays])}) — both ` +
        `would write to the same ticketType-${slug} document id, one silently clobbering the other`
    );
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
const totalLiveProducts = ADMISSION_PRODUCTS.length + CONFERENCE_PRODUCTS.length + WORKSHOP_FIELD_TRIP_PRODUCTS.length;
console.log(
  `PASS: all ${totalLiveProducts} live products carry the correct category field, no ` +
    'duplicate slug, no resurrected retired slug, no 4th category value.'
);
