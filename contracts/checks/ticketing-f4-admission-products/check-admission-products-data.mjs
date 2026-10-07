// A8 (ticketing-f4-admission-products) ORIGINAL — pinned ADMISSION_PRODUCTS to a full
// point-in-time snapshot: five specific slugs (one of them the now-renamed
// 'early-bird-weekend-pass'), with hand-typed price/capacity/releasedQuantity/earlyBirdCutoff
// per row. That snapshot was ALREADY stale before conference-workshop-tickets touched
// anything (weekend-pass's price had already moved 400 -> 380 in an earlier mission) and has
// since drifted further through real, intentional business-rule supersessions (ticketing-
// complete's 2026-09-08 VIP ruling, then conference-workshop-tickets F2's 2026-10-07
// reconciliation against Brad's ticket news / Lee-Ann's sheet — see
// .agent/memory/scratch/brad-ticket-news-2026-10-07.md,
// .agent/memory/scratch/leeann-notes-2026-10-07.md). A full-figure snapshot here duplicates,
// and inevitably desyncs from, each feature's OWN dedicated check scripts
// (contracts/checks/conference-workshop-tickets-f2/*), which are the live source of truth
// for exact current prices/capacities and which a figure change is REQUIRED to keep in sync.
//
// RECONCILED (conference-workshop-tickets, M1/F2, 2026-10-07) — keeps the ORIGINAL DEFECT
// CLASS this check exists to catch:
//   1. An invented sixth product (a "child ticket" or anything else) sneaking into
//      ADMISSION_PRODUCTS — out of scope, see the F4 golden README.
//   2. requiresDaySelection/requiresAttendeeNames swapped or leaked onto the wrong product —
//      these two booleans compile and run fine either way, so nothing but a data check
//      catches a swap.
// Updated to the current 5-slug identity set (hand-enumerated once, same convention as every
// sibling identity-check in this repo — e.g.
// ticketing-complete-f2/check-conference-product-families.mjs — not derived from a pattern
// at runtime, which would just move the "what counts as the real set" judgement into this
// script instead of stating it). Pool-sibling figures (early-bird,
// weekend-pass-early-bird) are now asserted against the REAL exported constants
// (`ADMISSION_EARLY_BIRD_POOL_CAPACITY`/`ADMISSION_EARLY_BIRD_POOL_KEY`) rather than a second
// hand-typed copy of 500/'admission-early-bird'. Exact price/capacity pinning for the other
// products is DROPPED from this check — that coverage lives in each feature's own dedicated
// checks now; this one keeps only structural sanity (positive, finite numbers) for those.
//
// Run as: npx tsx contracts/checks/ticketing-f4-admission-products/check-admission-products-data.mjs

import {
  ADMISSION_PRODUCTS,
  ADMISSION_EARLY_BIRD_POOL_CAPACITY,
  ADMISSION_EARLY_BIRD_POOL_KEY,
} from '../../../lib/provisional-figures.ts';

const failures = [];

// Hand-enumerated identity set — not a pattern, an EXACT list no invented product can slip
// into undetected. 'child' (or any other 6th product) must never appear.
const EXPECTED_SLUGS = ['early-bird', 'day-visitor', 'weekend-pass', 'weekend-pass-early-bird', 'vip'];

if (!Array.isArray(ADMISSION_PRODUCTS)) {
  console.error('FAIL: check-admission-products-data.mjs');
  console.error(`  - ADMISSION_PRODUCTS is not an array: ${JSON.stringify(ADMISSION_PRODUCTS)}`);
  process.exit(1);
}

const sortedSlugs = [...ADMISSION_PRODUCTS.map((p) => p.slug)].sort();
const sortedExpected = [...EXPECTED_SLUGS].sort();
if (JSON.stringify(sortedSlugs) !== JSON.stringify(sortedExpected)) {
  failures.push(
    `ADMISSION_PRODUCTS slugs must be exactly ${JSON.stringify(sortedExpected)}, got ${JSON.stringify(sortedSlugs)} — ` +
      'an invented product (e.g. a child ticket) must NOT appear here (out of scope — see the F4 golden README)'
  );
}

// Every live admission product is still web-team/council-provisional today — settlement is
// recorded via `sourceCitation`, not by flipping this flag (see lib/provisional-figures.ts's
// own doc comment on `provisional`).
for (const product of ADMISSION_PRODUCTS) {
  if (product.provisional !== true) {
    failures.push(`${product.slug}: provisional must be true, got ${JSON.stringify(product.provisional)}`);
  }
}

// CORE DEFECT CLASS (unchanged in spirit): requiresDaySelection/requiresAttendeeNames must
// never be swapped or leaked onto the wrong product. day-visitor's own early-bird sibling
// ('early-bird') now ALSO requires a day pick (conference-workshop-tickets F2 — both are
// day-visitor-shaped tickets sharing a pool), so the day-selecting set is two slugs now, not
// one; VIP alone still requires a named attendee.
const daySelectionSlugs = ADMISSION_PRODUCTS.filter((p) => p.requiresDaySelection === true)
  .map((p) => p.slug)
  .sort();
const expectedDaySelectionSlugs = ['day-visitor', 'early-bird'].sort();
if (JSON.stringify(daySelectionSlugs) !== JSON.stringify(expectedDaySelectionSlugs)) {
  failures.push(
    `requiresDaySelection must be true for EXACTLY ${JSON.stringify(expectedDaySelectionSlugs)}, got ${JSON.stringify(daySelectionSlugs)}`
  );
}
const attendeeNamesSlugs = ADMISSION_PRODUCTS.filter((p) => p.requiresAttendeeNames === true).map((p) => p.slug);
if (JSON.stringify(attendeeNamesSlugs) !== JSON.stringify(['vip'])) {
  failures.push(`requiresAttendeeNames must be true for EXACTLY ['vip'], got ${JSON.stringify(attendeeNamesSlugs)}`);
}

// Pool-sibling figures: derived from the real exported constants, never a second hand-typed
// copy of 500/'admission-early-bird'.
for (const slug of ['early-bird', 'weekend-pass-early-bird']) {
  const product = ADMISSION_PRODUCTS.find((p) => p.slug === slug);
  if (!product) continue; // already reported by the identity-set check above
  if (product.capacity !== ADMISSION_EARLY_BIRD_POOL_CAPACITY) {
    failures.push(
      `${slug}.capacity is ${JSON.stringify(product.capacity)}, expected ADMISSION_EARLY_BIRD_POOL_CAPACITY (${ADMISSION_EARLY_BIRD_POOL_CAPACITY})`
    );
  }
  if (product.capacityPool !== ADMISSION_EARLY_BIRD_POOL_KEY) {
    failures.push(
      `${slug}.capacityPool is ${JSON.stringify(product.capacityPool)}, expected ADMISSION_EARLY_BIRD_POOL_KEY (${JSON.stringify(ADMISSION_EARLY_BIRD_POOL_KEY)})`
    );
  }
}

// Generic sanity, not a figure snapshot: every product's price/capacity are positive, finite
// values — catches a genuinely broken value (NaN, 0, negative) without pinning the exact
// business number, which is each feature's own dedicated check scripts' job to keep current.
for (const product of ADMISSION_PRODUCTS) {
  if (!(typeof product.price === 'number' && Number.isFinite(product.price) && product.price > 0)) {
    failures.push(`${product.slug}: price must be a positive finite number, got ${JSON.stringify(product.price)}`);
  }
  if (!(Number.isInteger(product.capacity) && product.capacity > 0)) {
    failures.push(`${product.slug}: capacity must be a positive integer, got ${JSON.stringify(product.capacity)}`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: ADMISSION_PRODUCTS contains exactly the 5 live products with no invented sixth, correct ' +
    'day-selection/attendee-names partition, pool-sibling figures matching the real exported ' +
    'constants, and sane price/capacity values.'
);
