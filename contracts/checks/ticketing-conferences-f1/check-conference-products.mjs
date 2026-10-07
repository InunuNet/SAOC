// F1 (ticketing-conferences-and-events, M1) — originally proved CONFERENCE_PRODUCTS in
// lib/provisional-figures.ts had exactly the six required products (early-bird/normal pairs
// for SAOC Symposium, WOSA Conference, and a SAOC/WOSA Joint bundle), each with the correct
// fields, and that the early-bird/normal pairing was structurally sound (not just present).
//
// F1 (conference-workshop-tickets, M1) UPDATE (2026-10-07): Brad's verbatim ticket news
// directly supersedes the six-product model this check was written against — "No early bird
// for Symposiums and conferences" (message 6) drops the differential early-bird/normal price
// pair for both single-track products, and the SAOC/WOSA Joint bundle was already dropped by
// messages 3-4 (separate products, R2000 flat each, never a combined-purchase concept).
// CONFERENCE_PRODUCTS is now exactly TWO live products (saoc-symposium, wosa-conference),
// each a flat R2000/80-place singleton with no early-bird mechanism of any kind. The four
// retired slugs this replaces are named in lib/provisional-figures.ts's
// `RETIRED_CONFERENCE_SLUGS` export — never deleted, same convention as
// `RETIRED_FIELD_TRIP_SLUGS` — but no longer present in the live array this check inspects.
//
// THE DEFECT CLASS THIS TARGETS (unchanged in spirit)
// It would be easy to build two ticketType-shaped objects that "look right" (two names, two
// prices) but get the boolean/nullable fields wrong per-row — e.g. copy-pasting an admission
// product's requiresDaySelection:true onto a conference registration, or silently
// reintroducing an early-bird cutoff/staged release the 2026-10-07 revision explicitly
// removed. This check inspects the actual exported array, not source text, so it fails if
// the shape is wrong even if both names/prices are present.
//
// Run as: npx tsx contracts/checks/ticketing-conferences-f1/check-conference-products.mjs

import { CONFERENCE_PRODUCTS, RETIRED_CONFERENCE_SLUGS } from '../../../lib/provisional-figures.ts';

const failures = [];

function expect(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}: expected ${e}, got ${a}`);
}

const REQUIRED_SLUGS = ['saoc-symposium', 'wosa-conference'];

const RETIRED_SLUGS_MUST_BE_ABSENT = [
  'saoc-symposium-early-bird',
  'wosa-conference-early-bird',
  'saoc-wosa-joint-early-bird',
  'saoc-wosa-joint',
];

expect('CONFERENCE_PRODUCTS is an array', Array.isArray(CONFERENCE_PRODUCTS), true);
expect('exactly two products', CONFERENCE_PRODUCTS.length, 2);

const bySlug = Object.fromEntries((CONFERENCE_PRODUCTS || []).map((p) => [p.slug, p]));

for (const slug of REQUIRED_SLUGS) {
  if (!bySlug[slug]) failures.push(`missing required slug: ${slug}`);
}
for (const slug of RETIRED_SLUGS_MUST_BE_ABSENT) {
  if (bySlug[slug]) failures.push(`retired slug still present in the live array: ${slug}`);
}

// Every product: conference registration is multi-day, not a single admission day — must
// never require a day pick. Every product requires a named attendee for the badge/roll.
// No early-bird mechanism of any kind — the 2026-10-07 revision's whole point.
for (const p of CONFERENCE_PRODUCTS || []) {
  expect(`${p.slug} requiresDaySelection`, p.requiresDaySelection, false);
  expect(`${p.slug} requiresAttendeeNames`, p.requiresAttendeeNames, true);
  expect(`${p.slug} provisional`, p.provisional, true);
  expect(`${p.slug} price is a positive number`, typeof p.price === 'number' && p.price > 0, true);
  expect(`${p.slug} capacity is a positive integer`, Number.isInteger(p.capacity) && p.capacity > 0, true);
  expect(`${p.slug} earlyBirdCutoff === null`, p.earlyBirdCutoff, null);
  expect(`${p.slug} releasedQuantity === null`, p.releasedQuantity, null);
  expect(`${p.slug} sourceCitation is set`, Boolean(p.sourceCitation), true);
}

// Each surviving product is a flat R2000/80-place singleton — both figures real, sourced to
// Brad's 2026-10-07 ticket news (not an estimate carried over from the retired model).
for (const slug of REQUIRED_SLUGS) {
  const p = bySlug[slug];
  if (!p) continue;
  expect(`${slug} price === 2000`, p.price, 2000);
  expect(`${slug} capacity === 80`, p.capacity, 80);
}

if (!Array.isArray(RETIRED_CONFERENCE_SLUGS)) {
  failures.push('RETIRED_CONFERENCE_SLUGS is not exported as an array from lib/provisional-figures.ts');
} else {
  const retiredSet = new Set(RETIRED_CONFERENCE_SLUGS);
  const missingFromRetiredList = RETIRED_SLUGS_MUST_BE_ABSENT.filter((slug) => !retiredSet.has(slug));
  if (missingFromRetiredList.length > 0) {
    failures.push(`RETIRED_CONFERENCE_SLUGS is missing expected slug(s): ${JSON.stringify(missingFromRetiredList)}`);
  }
}

if (failures.length > 0) {
  console.error('FAIL:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`PASS: CONFERENCE_PRODUCTS (${(CONFERENCE_PRODUCTS || []).length} products) — all checks passed`);
