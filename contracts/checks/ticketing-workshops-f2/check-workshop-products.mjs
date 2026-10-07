// F2 (ticketing-conferences-and-events, M1) ORIGINAL — proved WORKSHOP_FIELD_TRIP_PRODUCTS
// had exactly the four sellable products of that era (Sunset Cocktails Single/Couple, Field
// Trip Single/All-Outings), each structurally sound, and that Workshops itself was NOT
// instantiated as a fifth product.
//
// RECONCILED (conference-workshop-tickets, M1/F2, 2026-10-07) — two of this check's
// assumptions are now obsolete, for reasons unrelated to each other:
//
//   1. `field-trip-single`/`field-trip-all-outings` were ALREADY retired by an earlier
//      mission (ticketing-complete, F2) in favour of a single flat-rate `field-trip` product
//      — see `RETIRED_FIELD_TRIP_SLUGS` — and this check was never reconciled to that
//      retirement (same stale pinning conference-workshop-tickets F1's dev already fixed in
//      check-pool-data-invariant.mjs). The field-trip bundle-price-comparison block below is
//      removed entirely with it — a single flat-rate product has no bundle to compare.
//   2. The sunset-cocktails "worst-case simultaneous sellout" arithmetic
//      (`single.capacity*1 + couple.capacity*2 <= 200`) assumed checkout enforces capacity
//      independently per slug with NO pooling — true when this check was written, but F5
//      (ticketing-conferences-and-events, M2) landed REAL capacity pooling
//      (`capacityPool`/`headcountPerUnit`, `planPooledCapacity()` in
//      lib/checkout-reservation.ts) and restored both figures to the real 200-head venue
//      ceiling BECAUSE pooling now enforces it correctly (see the capacity comment on
//      `SUNSET_COCKTAILS_POOL_CAPACITY` in lib/provisional-figures.ts). The old arithmetic
//      necessarily fails now that both members correctly declare the SAME real ceiling
//      instead of two independent conservative fractions of it — it was testing the pre-F5
//      world, already superseded before conference-workshop-tickets touched anything. Dropped
//      in favour of the real post-pooling invariant: both members share one identical,
//      non-empty `capacityPool`, each with the headcount weighting its own definition
//      requires (single = 1 head/unit, couple = 2 heads/unit — definitional, not a business
//      figure that drifts).
//
// `sunset-cocktails-couple` is RETIRED (`RETIRED_SUNSET_COCKTAILS_SLUGS`,
// conference-workshop-tickets F2, 2026-10-07) at the Sanity `active` flag level only — its
// PRODUCT DEFINITION stays in this array unchanged (order continuity for any already-issued
// order), so it is still counted as a live array member here; whether it should exist at all
// remains a separate, open needs-Brad item this check does not adjudicate.
//
// Run as: npx tsx contracts/checks/ticketing-workshops-f2/check-workshop-products.mjs

import {
  WORKSHOP_FIELD_TRIP_PRODUCTS,
  WORKSHOP_PRICING_STRUCTURE,
  RETIRED_FIELD_TRIP_SLUGS,
} from '../../../lib/provisional-figures.ts';

const failures = [];

function expect(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}: expected ${e}, got ${a}`);
}

const REQUIRED_SLUGS = ['sunset-cocktails-single', 'sunset-cocktails-couple', 'field-trip'];

expect('WORKSHOP_FIELD_TRIP_PRODUCTS is an array', Array.isArray(WORKSHOP_FIELD_TRIP_PRODUCTS), true);
expect(
  'exactly three live products (Workshops is NOT a fourth entry)',
  WORKSHOP_FIELD_TRIP_PRODUCTS.length,
  REQUIRED_SLUGS.length
);

const bySlug = Object.fromEntries((WORKSHOP_FIELD_TRIP_PRODUCTS || []).map((p) => [p.slug, p]));

for (const slug of REQUIRED_SLUGS) {
  if (!bySlug[slug]) failures.push(`missing required slug: ${slug}`);
}

// The other half of "derive, don't snapshot": the two retired field-trip bundle-split slugs
// must never resurface — derived from RETIRED_FIELD_TRIP_SLUGS itself, not a second
// hand-typed copy of the same two names.
for (const slug of RETIRED_FIELD_TRIP_SLUGS ?? []) {
  if (bySlug[slug]) {
    failures.push(`retired slug still present in WORKSHOP_FIELD_TRIP_PRODUCTS: ${slug}`);
  }
}

// No product name/slug may claim to BE a workshop session — proves the "Workshops is a
// pricing structure, not a fabricated sellable product" decision, not just an absent slug.
for (const p of WORKSHOP_FIELD_TRIP_PRODUCTS || []) {
  const hay = `${p.slug} ${p.name} ${p.description}`.toLowerCase();
  if (/workshop/.test(hay)) {
    failures.push(`${p.slug}: workshops must not appear as a sellable ticketType product — found "workshop" in ${hay}`);
  }
  if (/\bevents\b/.test(hay)) {
    failures.push(`${p.slug}: bare "Events" found in product copy — ${hay}`);
  }
  expect(`${p.slug} provisional`, p.provisional, true);
  expect(`${p.slug} requiresDaySelection`, p.requiresDaySelection, false);
  expect(`${p.slug} requiresAttendeeNames`, p.requiresAttendeeNames, true);
  expect(`${p.slug} price is a positive number`, typeof p.price === 'number' && p.price > 0, true);
  expect(`${p.slug} capacity is a positive integer`, Number.isInteger(p.capacity) && p.capacity > 0, true);
}

// Couple is a real bundle relative to two singles: cheaper than 2x single, pricier than a
// single alone (never a de facto free-upgrade or a non-discount). Unaffected by the pooling
// change below — this is a PRICE relationship, not a capacity one.
const cocktailSingle = bySlug['sunset-cocktails-single'];
const cocktailCouple = bySlug['sunset-cocktails-couple'];
if (cocktailSingle && cocktailCouple) {
  expect(
    'cocktails couple price is a real bundle (cheaper than 2x single)',
    cocktailCouple.price < 2 * cocktailSingle.price,
    true
  );
  expect(
    'cocktails couple price is still pricier than a single ticket alone',
    cocktailCouple.price > cocktailSingle.price,
    true
  );

  // POST-F5 pooling invariant, replacing the old pre-pooling "independent worst-case sum"
  // arithmetic (see header comment): both members must share one identical, non-empty
  // capacityPool, and each must carry the headcount weighting its own definition requires —
  // a "couple" ticket is inherently 2 attendees, a "single" is 1, by definition, not a
  // business figure that drifts with pricing decisions.
  expect(
    'sunset-cocktails-single/couple share one identical, non-empty capacityPool',
    Boolean(cocktailSingle.capacityPool) && cocktailSingle.capacityPool === cocktailCouple.capacityPool,
    true
  );
  expect('sunset-cocktails-single headcountPerUnit', cocktailSingle.headcountPerUnit, 1);
  expect('sunset-cocktails-couple headcountPerUnit', cocktailCouple.headcountPerUnit, 2);
}

// Workshops must be documented as a pricing STRUCTURE (an object with a per-session estimate
// and an explicit provisional flag), never as a ticketType-shaped sellable entry.
expect(
  'WORKSHOP_PRICING_STRUCTURE is a plain object, not an array (never ticketType-shaped)',
  typeof WORKSHOP_PRICING_STRUCTURE === 'object' && !Array.isArray(WORKSHOP_PRICING_STRUCTURE),
  true
);
expect('WORKSHOP_PRICING_STRUCTURE.model', WORKSHOP_PRICING_STRUCTURE?.model, 'per-session');
expect(
  'WORKSHOP_PRICING_STRUCTURE.estimatedSessionPrice is a positive number',
  typeof WORKSHOP_PRICING_STRUCTURE?.estimatedSessionPrice === 'number' &&
    WORKSHOP_PRICING_STRUCTURE.estimatedSessionPrice > 0,
  true
);
// RECONCILED (conference-workshop-tickets, M1/F1, 2026-10-07): the R100/10-per-session figure
// is now Brad's real, direct, settled ruling (verbatim message 2 — "Workshops R100 each.
// Total 10 Tickets per session"), not a web-team estimate — `provisional: false` is correct,
// same settlement convention as VIP's `sourceCitation` elsewhere in this file. This was
// `true` when this check was first written, before that figure existed.
expect('WORKSHOP_PRICING_STRUCTURE.provisional', WORKSHOP_PRICING_STRUCTURE?.provisional, false);
if (!WORKSHOP_PRICING_STRUCTURE?.sourceCitation) {
  failures.push('WORKSHOP_PRICING_STRUCTURE.sourceCitation must be set now that provisional is false (settled, not a guess)');
}
if (
  !WORKSHOP_PRICING_STRUCTURE?.note ||
  typeof WORKSHOP_PRICING_STRUCTURE.note !== 'string' ||
  WORKSHOP_PRICING_STRUCTURE.note.length < 20
) {
  failures.push(
    'WORKSHOP_PRICING_STRUCTURE.note must be a real explanatory string (why no sellable session exists yet)'
  );
}
if (WORKSHOP_PRICING_STRUCTURE?.slug || WORKSHOP_PRICING_STRUCTURE?.capacity !== undefined) {
  failures.push(
    'WORKSHOP_PRICING_STRUCTURE must not carry slug/capacity fields — those belong to a real ' +
      'ticketType-shaped product, which Workshops deliberately is not yet'
  );
}

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} issue(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('PASS — WORKSHOP_FIELD_TRIP_PRODUCTS and WORKSHOP_PRICING_STRUCTURE are structurally sound.');
