// F2 (ticketing-conferences-and-events, M1) — proves WORKSHOP_FIELD_TRIP_PRODUCTS in
// lib/provisional-figures.ts has exactly the four sellable products (Sunset Cocktails
// Single/Couple, Field Trip Single/All-Outings), each structurally sound, AND that Workshops
// itself was deliberately NOT instantiated as a fifth product — proving the "per-session
// structure documented, not a fake sellable session" design decision held in the actual file,
// not just in the golden's stated intent.
//
// THE DEFECT CLASS THIS TARGETS
// Two failure modes, symmetric to each other:
//   1. A dev under time pressure invents a plausible-looking "Workshop Session" ticketType
//      entry (a name, a price, a capacity) to make the array "feel complete" — exactly the
//      fabricated-placeholder failure this feature exists to prevent. A1 proves the array
//      length is exactly 4, so a 5th invented entry fails even if it looks reasonable.
//   2. The couple/all-outings bundle prices regress to a non-bundle (equal to or above the
//      cost of buying the components separately) — same "Joint priced above sum of singles"
//      defect class F1's checker already caught for Conferences.
//
// Run as: npx tsx contracts/checks/ticketing-workshops-f2/check-workshop-products.mjs

import {
  WORKSHOP_FIELD_TRIP_PRODUCTS,
  WORKSHOP_PRICING_STRUCTURE,
} from '../../../lib/provisional-figures.ts';

const failures = [];

function expect(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}: expected ${e}, got ${a}`);
}

const REQUIRED_SLUGS = [
  'sunset-cocktails-single',
  'sunset-cocktails-couple',
  'field-trip-single',
  'field-trip-all-outings',
];

expect(
  'WORKSHOP_FIELD_TRIP_PRODUCTS is an array',
  Array.isArray(WORKSHOP_FIELD_TRIP_PRODUCTS),
  true
);
expect('exactly four sellable products (Workshops is NOT a fifth entry)', WORKSHOP_FIELD_TRIP_PRODUCTS.length, 4);

const bySlug = Object.fromEntries((WORKSHOP_FIELD_TRIP_PRODUCTS || []).map((p) => [p.slug, p]));

for (const slug of REQUIRED_SLUGS) {
  if (!bySlug[slug]) failures.push(`missing required slug: ${slug}`);
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
// single alone (never a de facto free-upgrade or a non-discount).
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
}

// All-Outings is a real bundle relative to Single: cheaper than the documented assumed
// outing count times Single, pricier than a single outing alone.
const fieldTripSingle = bySlug['field-trip-single'];
const fieldTripAll = bySlug['field-trip-all-outings'];
if (fieldTripSingle && fieldTripAll) {
  expect(
    'field trip all-outings price is a real bundle (pricier than a single outing alone)',
    fieldTripAll.price > fieldTripSingle.price,
    true
  );
  expect(
    'field trip all-outings price is below 3x a single outing (our documented assumed-outing-count ceiling)',
    fieldTripAll.price < 3 * fieldTripSingle.price,
    true
  );
}

// --- Oversell invariants (Codex GPT-5.5 cross-model review finding, real defect, 2026-08-21) ---
// Checkout enforces capacity STRICTLY PER TICKETTYPE SLUG (lib/checkout-reservation.ts
// effectiveCapacity() feeds capacityByType[slug] one-for-one from the Sanity ticketType
// document's own `capacity` field; lib/data/tickets.ts getSoldCountsByTicketType() counts one
// Firestore `tickets` position document as exactly one unit against that slug's own counter).
// There is ZERO pooling or occupancy-weighting across slugs anywhere in that code path. Two
// consequences neither F1's nor the original F2 checks caught:
//   1. `sunset-cocktails-couple` claims 2 physical seats per unit sold (it's a two-guest
//      product, by definition) but only ever consumes 1 unit of ITS OWN capacity counter —
//      so a sold-out couple product under-counts real headcount against the venue.
//   2. `field-trip-single` and `field-trip-all-outings` are two INDEPENDENT capacity counters
//      that both draw on the SAME physical bus/trip pool — selling both to their own
//      independent ceilings can jointly exceed the real seat count.
// Actually enforcing either as a live, dynamic checkout-time guard (a shared decrementing pool,
// or an occupancy-weighted capacity check) is checkout LOGIC, not a data-shape change — out of
// scope for F2 and overlapping with Mission Two F4's checkout-support brief. This pass instead
// sizes the CAPACITY NUMBERS conservatively so that even the worst case — both competing slugs
// simultaneously selling out to their own independent, unweighted capacity ceiling — can never
// exceed the real physical limit. These two checks prove that invariant against the ACTUAL
// exported capacity numbers (not the numbers as of this commit), so a future capacity edit that
// reintroduces the oversell is caught here, not just fixed once and forgotten.
const REAL_SUNSET_COCKTAILS_VENUE_HEAD_CAPACITY = 200; // The Hangar, single evening, all heads
const REAL_FIELD_TRIP_POOL_CAPACITY = 60; // bus/shuttle seats, shared by both trip products
const COUPLE_OCCUPANCY_PER_UNIT = 2; // a "couple" ticket is inherently 2 attendees, by definition

if (cocktailSingle && cocktailCouple) {
  const worstCaseHeads =
    cocktailSingle.capacity * 1 + cocktailCouple.capacity * COUPLE_OCCUPANCY_PER_UNIT;
  expect(
    'sunset cocktails: worst-case simultaneous sellout of single+couple never exceeds the ' +
      `real venue head capacity (${REAL_SUNSET_COCKTAILS_VENUE_HEAD_CAPACITY})`,
    worstCaseHeads <= REAL_SUNSET_COCKTAILS_VENUE_HEAD_CAPACITY,
    true
  );
}

if (fieldTripSingle && fieldTripAll) {
  const worstCaseSeats = fieldTripSingle.capacity + fieldTripAll.capacity;
  expect(
    'field trip: worst-case simultaneous sellout of both independently-capped slugs never ' +
      `exceeds the shared bus/trip pool (${REAL_FIELD_TRIP_POOL_CAPACITY})`,
    worstCaseSeats <= REAL_FIELD_TRIP_POOL_CAPACITY,
    true
  );
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
expect('WORKSHOP_PRICING_STRUCTURE.provisional', WORKSHOP_PRICING_STRUCTURE?.provisional, true);
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
