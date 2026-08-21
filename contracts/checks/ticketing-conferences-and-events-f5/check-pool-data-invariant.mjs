// F5 (ticketing-conferences-and-events, M2) — proves the real capacity-pooling fix landed in
// the DATA, not just in code that nothing calls. Two things this guards against:
//
//   1. A future edit desyncs two products sharing a `capacityPool` (e.g. someone bumps
//      sunset-cocktails-single's capacity to 220 without touching sunset-cocktails-couple's) —
//      the whole pooled-capacity design depends on every pool member declaring the SAME real
//      physical ceiling in its own `capacity` field, since route.ts reads whichever member is
//      in the cart and trusts that number as the pool ceiling.
//   2. The real ceiling numbers (200 heads for Sunset Cocktails, 60 seats for Field Trip) never
//      quietly regress back to F2's interim worst-case-safe-but-conservative resize
//      (100/50/30/30) now that pooling can enforce the real ceiling correctly — that resize was
//      explicitly flagged in contracts/golden/ticketing-workshops-f2/README.md as an interim
//      fix this feature owns replacing, not a target to leave alone.
//
// Run as: npx tsx contracts/checks/ticketing-conferences-and-events-f5/check-pool-data-invariant.mjs

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

const bySlug = Object.fromEntries(
  (WORKSHOP_FIELD_TRIP_PRODUCTS || []).map((p) => [p.slug, p])
);

const REQUIRED = {
  'sunset-cocktails-single': { capacityPool: 'sunset-cocktails', headcountPerUnit: 1, capacity: 200 },
  'sunset-cocktails-couple': { capacityPool: 'sunset-cocktails', headcountPerUnit: 2, capacity: 200 },
  'field-trip-single': { capacityPool: 'field-trip', headcountPerUnit: 1, capacity: 60 },
  'field-trip-all-outings': { capacityPool: 'field-trip', headcountPerUnit: 1, capacity: 60 },
};

for (const [slug, expected] of Object.entries(REQUIRED)) {
  const product = bySlug[slug];
  if (!product) {
    failures.push(`missing required slug: ${slug}`);
    continue;
  }
  expect(`${slug}.capacityPool`, product.capacityPool, expected.capacityPool);
  expect(`${slug}.headcountPerUnit`, product.headcountPerUnit, expected.headcountPerUnit);
  expect(`${slug}.capacity`, product.capacity, expected.capacity);
}

// Generic invariant, not a hardcoded numbers-match: every product sharing a non-null
// capacityPool across ALL THREE arrays must declare the identical capacity AND
// releasedQuantity — the real physical ceiling, once, agreed by every member. A future pool
// added anywhere else in provisional-figures.ts is covered by this loop automatically.
const allProducts = [
  ...(ADMISSION_PRODUCTS || []),
  ...(CONFERENCE_PRODUCTS || []),
  ...(WORKSHOP_FIELD_TRIP_PRODUCTS || []),
];

const byPool = new Map();
for (const product of allProducts) {
  const pool = product.capacityPool ?? null;
  if (pool === null) continue;
  if (!byPool.has(pool)) byPool.set(pool, []);
  byPool.get(pool).push(product);
}

for (const [pool, members] of byPool) {
  const [first, ...rest] = members;
  for (const member of rest) {
    if (member.capacity !== first.capacity) {
      failures.push(
        `pool "${pool}": ${first.slug}.capacity (${first.capacity}) !== ${member.slug}.capacity (${member.capacity}) — every pool member must declare the same real physical ceiling`
      );
    }
    if ((member.releasedQuantity ?? null) !== (first.releasedQuantity ?? null)) {
      failures.push(
        `pool "${pool}": ${first.slug}.releasedQuantity (${first.releasedQuantity}) !== ${member.slug}.releasedQuantity (${member.releasedQuantity})`
      );
    }
  }
}

// Scope guard: Admission and Conference products must NOT have picked up a pool as a side
// effect of this feature — they stay per-slug (capacityPool null/undefined), same as today.
for (const product of [...(ADMISSION_PRODUCTS || []), ...(CONFERENCE_PRODUCTS || [])]) {
  if (product.capacityPool) {
    failures.push(
      `${product.slug}: unexpected capacityPool "${product.capacityPool}" — Admission/Conference products must stay per-slug, this feature's pooling is scoped to Workshops/Field-Trip/Cocktails only`
    );
  }
}

if (failures.length > 0) {
  console.error('FAIL');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('PASS');
process.exit(0);
