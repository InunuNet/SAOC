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
  RETIRED_FIELD_TRIP_SLUGS,
  ADMISSION_EARLY_BIRD_POOL_KEY,
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

// DEFECT REPAIR (Codex GPT-5.5 cross-model review, conference-workshop-tickets M1/F1,
// 2026-10-07): this table was already stale before F1 touched anything — 'field-trip-single'
// and 'field-trip-all-outings' are the two invented bundle-split SKUs F2 (ticketing-complete)
// retired in favour of the single flat-rate 'field-trip' product (see
// `RETIRED_FIELD_TRIP_SLUGS`), but this check was never reconciled to that retirement. Fixed
// to the current live member (`field-trip`), with the real settled capacity/pool figures
// unchanged (these are business facts — Sunset Cocktails' 200-head venue ceiling, Field
// Trip's 60-seat vehicle ceiling — not a catalogue count that drifts with product
// additions/retirements, so pinning them here is not the staleness this repair targets).
const REQUIRED = {
  'sunset-cocktails-single': { capacityPool: 'sunset-cocktails', headcountPerUnit: 1, capacity: 200 },
  'sunset-cocktails-couple': { capacityPool: 'sunset-cocktails', headcountPerUnit: 2, capacity: 200 },
  'field-trip': { capacityPool: 'field-trip', headcountPerUnit: 1, capacity: 60 },
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

// The other half of "derive, don't snapshot": the two retired slugs above must never
// resurface as live pool members — derived from RETIRED_FIELD_TRIP_SLUGS itself, not a
// second hand-typed copy of the same two names.
for (const slug of RETIRED_FIELD_TRIP_SLUGS ?? []) {
  if (bySlug[slug]) {
    failures.push(`retired slug still present in WORKSHOP_FIELD_TRIP_PRODUCTS: ${slug}`);
  }
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

// Scope guard, NARROWED (conference-workshop-tickets, M1/F2, 2026-10-07): Brad's ticket
// news, message 6, extends pooling to two Admission products (weekend-pass-early-bird and
// day-visitor's own early-bird sibling share a single 500-ticket pool, counted by units sold
// — see check-shared-pool-key-identical.mjs in conference-workshop-tickets-f2/). So Admission
// products may now carry EXACTLY ONE pool key — the real exported
// `ADMISSION_EARLY_BIRD_POOL_KEY` constant, never a second hand-typed copy of the literal and
// never any OTHER pool — while Conference products stay per-slug entirely, unchanged.
for (const product of ADMISSION_PRODUCTS || []) {
  if (product.capacityPool && product.capacityPool !== ADMISSION_EARLY_BIRD_POOL_KEY) {
    failures.push(
      `${product.slug}: unexpected capacityPool "${product.capacityPool}" — Admission products may only ` +
        `share ADMISSION_EARLY_BIRD_POOL_KEY ("${ADMISSION_EARLY_BIRD_POOL_KEY}"), never a different pool`
    );
  }
}
for (const product of CONFERENCE_PRODUCTS || []) {
  if (product.capacityPool) {
    failures.push(
      `${product.slug}: unexpected capacityPool "${product.capacityPool}" — Conference products must stay ` +
        'per-slug, pooling is not scoped to Conference products'
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
