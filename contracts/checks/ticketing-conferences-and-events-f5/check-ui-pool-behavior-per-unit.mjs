// F5 (ticketing-conferences-and-events, M2) — second Codex GPT-5.5 defect repair (2026-08-21,
// Defect 1: UI correctness). A7 (check-pooled-capacity-behavior.mjs) already proves
// planPooledCapacity()'s core math against checkout's own call shape: a full cart's aggregate
// requested quantities per slug, checked once per checkout attempt. CategoryTicketsPage.tsx
// calls the SAME function a different way — once per LISTED product, asking "would exactly 1
// more unit of this slug fit?" (`requestedQtyByType: { [t.slug]: 1 }`), to decide that one
// product's individual soldOut flag. This script proves that per-unit "would 1 fit" call shape
// is also correct, including the two conditions unique to the UI's usage:
//   1. A product whose OWN sold count is low must still be reported over-capacity when its POOL
//      is already exhausted by a SIBLING's sales — this is Defect 1 itself: comparing a
//      product's own sold count against its own capacity field (the full pool ceiling) almost
//      never trips, because the product's own count is rarely the whole pool.
//   2. A sibling that never appears in the category's own listing (a different category page,
//      or inactive) still contributes its sold heads to the shared ceiling — proving the value
//      of fetching pool siblings via ticketTypesByPoolQuery, not just the listed page's own
//      products.
// Calls the real function with concrete inputs and asserts its returned decision — not a
// text/name match.
//
// Run as: npx tsx contracts/checks/ticketing-conferences-and-events-f5/check-ui-pool-behavior-per-unit.mjs

import { planPooledCapacity } from '../../../lib/checkout-reservation.ts';

const failures = [];

function expectSoldOut(name, slug, input, expected) {
  const result = planPooledCapacity({
    requestedQtyByType: { [slug]: 1 },
    soldCountsByType: input.soldCountsByType,
    capacityByType: input.capacityByType,
    poolConfigByType: input.poolConfigByType,
  });
  const gotSoldOut = result.kind === 'over-capacity';
  if (gotSoldOut !== expected) {
    failures.push(
      `${name}: expected soldOut=${expected} for a "would 1 more ${slug} fit?" check, got ` +
        `soldOut=${gotSoldOut} (${JSON.stringify(result)})`
    );
  }
}

// --- Test 1: own sold count is 0, but a SIBLING already fills the pool. Defect 1's exact shape:
// comparing a product's own sold count (0) against its own capacity field (which under the old
// UI code held the full 200-head pool ceiling) never trips sold-out. The correct pooled check
// must still reject, because the couple sibling already consumed all 200 heads. ---
{
  expectSoldOut(
    'sibling exhausts the pool, this slug has 0 sales of its own',
    'sunset-cocktails-single',
    {
      soldCountsByType: { 'sunset-cocktails-couple': 100 }, // 100 * 2 heads = 200 heads, full ceiling
      capacityByType: { 'sunset-cocktails': 200 },
      poolConfigByType: {
        'sunset-cocktails-single': { pool: 'sunset-cocktails', headcountPerUnit: 1 },
        'sunset-cocktails-couple': { pool: 'sunset-cocktails', headcountPerUnit: 2 },
      },
    },
    true
  );
}

// --- Test 2: pool has exactly 1 head of room left — "would 1 more fit?" must say yes. ---
{
  expectSoldOut(
    'pool has exactly 1 head of room left',
    'sunset-cocktails-single',
    {
      soldCountsByType: { 'sunset-cocktails-single': 100, 'sunset-cocktails-couple': 49 }, // 100 + 98 = 198
      capacityByType: { 'sunset-cocktails': 200 },
      poolConfigByType: {
        'sunset-cocktails-single': { pool: 'sunset-cocktails', headcountPerUnit: 1 },
        'sunset-cocktails-couple': { pool: 'sunset-cocktails', headcountPerUnit: 2 },
      },
    },
    false
  );
}

// --- Test 3: pool has 0 heads of room left — "would 1 more fit?" must say no. ---
{
  expectSoldOut(
    'pool has 0 heads of room left',
    'sunset-cocktails-single',
    {
      soldCountsByType: { 'sunset-cocktails-single': 100, 'sunset-cocktails-couple': 50 }, // 100 + 100 = 200
      capacityByType: { 'sunset-cocktails': 200 },
      poolConfigByType: {
        'sunset-cocktails-single': { pool: 'sunset-cocktails', headcountPerUnit: 1 },
        'sunset-cocktails-couple': { pool: 'sunset-cocktails', headcountPerUnit: 2 },
      },
    },
    true
  );
}

// --- Test 4: a sibling NOT present in the category's own listing (simulating a product listed
// only on a different category page, or inactive but still fetched via ticketTypesByPoolQuery)
// still contributes its sold heads. Field Trip pool: field-trip-all-outings is the "sibling not
// on this page", already having sold enough to fill the pool. ---
{
  expectSoldOut(
    'off-page/inactive sibling already fills the pool',
    'field-trip-single',
    {
      soldCountsByType: { 'field-trip-all-outings': 60 },
      capacityByType: { 'field-trip': 60 },
      poolConfigByType: {
        'field-trip-single': { pool: 'field-trip', headcountPerUnit: 1 },
        'field-trip-all-outings': { pool: 'field-trip', headcountPerUnit: 1 },
      },
    },
    true
  );
}

if (failures.length > 0) {
  console.error('FAIL');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('PASS');
process.exit(0);
