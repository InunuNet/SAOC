// F1 (ticketing-conferences-and-events, M1) — proves CONFERENCE_PRODUCTS in
// lib/provisional-figures.ts has exactly the six required products, each with the correct
// fields, and that the early-bird/normal pairing is structurally sound (not just present).
//
// THE DEFECT CLASS THIS TARGETS
// It would be easy to build six ticketType-shaped objects that "look right" (six names, six
// prices) but get the boolean/nullable fields wrong per-row — e.g. copy-pasting an admission
// product's requiresDaySelection:true onto a conference registration, or forgetting that a
// "Normal" (non-early-bird) row must have earlyBirdCutoff: null and releasedQuantity: null
// while its "Early-Bird" sibling must have both set. This check inspects the actual exported
// array, not source text, so it fails if the shape is wrong even if all six names/prices are
// present.
//
// Run as: npx tsx contracts/checks/ticketing-conferences-f1/check-conference-products.mjs

import { CONFERENCE_PRODUCTS, EARLY_BIRD_CUTOFF } from '../../../lib/provisional-figures.ts';

const failures = [];

function expect(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}: expected ${e}, got ${a}`);
}

const REQUIRED_SLUGS = [
  'saoc-symposium-early-bird',
  'saoc-symposium',
  'wosa-conference-early-bird',
  'wosa-conference',
  'saoc-wosa-joint-early-bird',
  'saoc-wosa-joint',
];

expect('CONFERENCE_PRODUCTS is an array', Array.isArray(CONFERENCE_PRODUCTS), true);
expect('exactly six products', CONFERENCE_PRODUCTS.length, 6);

const bySlug = Object.fromEntries((CONFERENCE_PRODUCTS || []).map((p) => [p.slug, p]));

for (const slug of REQUIRED_SLUGS) {
  if (!bySlug[slug]) failures.push(`missing required slug: ${slug}`);
}

// Every product: conference registration is multi-day, not a single admission day — must
// never require a day pick. Every product requires a named attendee for the badge/roll.
for (const p of CONFERENCE_PRODUCTS || []) {
  expect(`${p.slug} requiresDaySelection`, p.requiresDaySelection, false);
  expect(`${p.slug} requiresAttendeeNames`, p.requiresAttendeeNames, true);
  expect(`${p.slug} provisional`, p.provisional, true);
  expect(`${p.slug} price is a positive number`, typeof p.price === 'number' && p.price > 0, true);
  expect(`${p.slug} capacity is a positive integer`, Number.isInteger(p.capacity) && p.capacity > 0, true);
}

// Early-bird rows: cutoff is the shared EARLY_BIRD_CUTOFF constant (not a re-typed literal),
// and releasedQuantity is set (equal to capacity, matching the admission-products precedent).
for (const slug of ['saoc-symposium-early-bird', 'wosa-conference-early-bird', 'saoc-wosa-joint-early-bird']) {
  const p = bySlug[slug];
  if (!p) continue;
  expect(`${slug} earlyBirdCutoff === EARLY_BIRD_CUTOFF`, p.earlyBirdCutoff, EARLY_BIRD_CUTOFF);
  expect(`${slug} releasedQuantity === capacity`, p.releasedQuantity, p.capacity);
}

// Normal rows: no early-bird window, no staged release.
for (const slug of ['saoc-symposium', 'wosa-conference', 'saoc-wosa-joint']) {
  const p = bySlug[slug];
  if (!p) continue;
  expect(`${slug} earlyBirdCutoff === null`, p.earlyBirdCutoff, null);
  expect(`${slug} releasedQuantity === null`, p.releasedQuantity, null);
}

// Joint early-bird/normal must each be cheaper than buying the two matching single-track
// early-bird/normal prices separately (the whole point of a "Joint" bundle product) but
// still more expensive than either single track alone (never a de facto discount deeper
// than free).
const symEB = bySlug['saoc-symposium-early-bird'];
const wosaEB = bySlug['wosa-conference-early-bird'];
const jointEB = bySlug['saoc-wosa-joint-early-bird'];
if (symEB && wosaEB && jointEB) {
  expect(
    'joint early-bird price is a real bundle (cheaper than sum of the two singles)',
    jointEB.price < symEB.price + wosaEB.price,
    true
  );
  expect(
    'joint early-bird price is still pricier than either single track alone',
    jointEB.price > Math.max(symEB.price, wosaEB.price),
    true
  );
}
const symN = bySlug['saoc-symposium'];
const wosaN = bySlug['wosa-conference'];
const jointN = bySlug['saoc-wosa-joint'];
if (symN && wosaN && jointN) {
  expect('joint normal price is a real bundle', jointN.price < symN.price + wosaN.price, true);
  expect(
    'joint normal price is still pricier than either single track alone',
    jointN.price > Math.max(symN.price, wosaN.price),
    true
  );
}

// Every early-bird row must be strictly cheaper than its own normal sibling — otherwise
// "early-bird" is not actually an incentive.
const PAIRS = [
  ['saoc-symposium-early-bird', 'saoc-symposium'],
  ['wosa-conference-early-bird', 'wosa-conference'],
  ['saoc-wosa-joint-early-bird', 'saoc-wosa-joint'],
];
for (const [ebSlug, normalSlug] of PAIRS) {
  const eb = bySlug[ebSlug];
  const normal = bySlug[normalSlug];
  if (eb && normal) {
    expect(`${ebSlug} price < ${normalSlug} price`, eb.price < normal.price, true);
  }
}

if (failures.length > 0) {
  console.error('FAIL:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`PASS: CONFERENCE_PRODUCTS (${(CONFERENCE_PRODUCTS || []).length} products) — all checks passed`);
