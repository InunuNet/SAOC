// F2 (conference-workshop-tickets, M1) — A9: SUNSET_COCKTAILS_POOL_CAPACITY is still 200
// (the real post-F5 physical ceiling, not the superseded 100 interim estimate),
// sunset-cocktails-single/couple figures unchanged, field-trip unchanged — none of these
// three have their FIGURES touched by this feature. (The couple SKU's retirement EXPORT
// is new — see check-retired-sunset-cocktails-slugs.mjs — but its PRODUCT DEFINITION here
// must stay byte-identical.)
import { loadRepoModule, finish } from './_lib.mjs';

const { WORKSHOP_FIELD_TRIP_PRODUCTS } = await loadRepoModule('lib/provisional-figures.ts');

const EXPECTED = {
  'sunset-cocktails-single': { price: 800, capacity: 200, capacityPool: 'sunset-cocktails', headcountPerUnit: 1 },
  'sunset-cocktails-couple': { price: 1500, capacity: 200, capacityPool: 'sunset-cocktails', headcountPerUnit: 2 },
  'field-trip': { price: 200, capacity: 60, capacityPool: 'field-trip', headcountPerUnit: 1 },
};

const failures = [];

for (const [slug, expected] of Object.entries(EXPECTED)) {
  const product = WORKSHOP_FIELD_TRIP_PRODUCTS.find((p) => p.slug === slug);
  if (!product) {
    failures.push(`'${slug}': no such product in WORKSHOP_FIELD_TRIP_PRODUCTS`);
    continue;
  }
  for (const [field, value] of Object.entries(expected)) {
    if (product[field] !== value) {
      failures.push(`'${slug}': ${field} is ${JSON.stringify(product[field])}, expected ${JSON.stringify(value)}`);
    }
  }
}

finish(
  'check-sunset-cocktails-and-field-trip-unchanged.mjs',
  failures,
  'sunset-cocktails-single/couple and field-trip figures are untouched by this feature (pool capacity 200).',
);
