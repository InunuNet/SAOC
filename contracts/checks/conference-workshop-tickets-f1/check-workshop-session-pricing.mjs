// F1 (conference-workshop-tickets, M1) — A5: WORKSHOP_SESSION_PRICE (100) and
// WORKSHOP_SESSION_CAPACITY (10) exist as real, Brad-sourced constants (not the old
// 120-estimate), WORKSHOP_PRICING_STRUCTURE carries the same real figures with a
// sourceCitation, and WORKSHOP_FIELD_TRIP_PRODUCTS (sunset-cocktails-single/couple,
// field-trip) is byte-unchanged by this mission.
//
// "Byte-unchanged" is checked structurally (deep-equal against the exact pre-mission
// values), not by a line-count or hash of the whole file, so an edit to WORKSHOP_FIELD_TRIP_
// PRODUCTS itself is caught even if an unrelated part of the file also changed length.
//
// Run as: node contracts/checks/conference-workshop-tickets-f1/check-workshop-session-pricing.mjs
// (also runs under `npx tsx` directly). Registers tsx's ESM loader programmatically — see
// check-retired-conference-slugs.mjs's own comment for why.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { register } from 'tsx/esm/api';

register();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  WORKSHOP_SESSION_PRICE,
  WORKSHOP_SESSION_CAPACITY,
  WORKSHOP_PRICING_STRUCTURE,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
} = await import(path.join(__dirname, '../../../lib/provisional-figures.ts'));

const failures = [];

if (WORKSHOP_SESSION_PRICE !== 100) {
  failures.push(`WORKSHOP_SESSION_PRICE is ${JSON.stringify(WORKSHOP_SESSION_PRICE)}, expected 100`);
}
if (WORKSHOP_SESSION_CAPACITY !== 10) {
  failures.push(`WORKSHOP_SESSION_CAPACITY is ${JSON.stringify(WORKSHOP_SESSION_CAPACITY)}, expected 10`);
}

if (WORKSHOP_PRICING_STRUCTURE?.estimatedSessionPrice !== 100) {
  failures.push(
    `WORKSHOP_PRICING_STRUCTURE.estimatedSessionPrice is ` +
      `${JSON.stringify(WORKSHOP_PRICING_STRUCTURE?.estimatedSessionPrice)}, expected 100`,
  );
}
if (WORKSHOP_PRICING_STRUCTURE?.model !== 'per-session') {
  failures.push(`WORKSHOP_PRICING_STRUCTURE.model is ${JSON.stringify(WORKSHOP_PRICING_STRUCTURE?.model)}, expected 'per-session'`);
}
if (WORKSHOP_PRICING_STRUCTURE?.provisional !== false) {
  failures.push(
    `WORKSHOP_PRICING_STRUCTURE.provisional is ${JSON.stringify(WORKSHOP_PRICING_STRUCTURE?.provisional)}, ` +
      'expected false — Brad gave a direct, unambiguous figure, not an estimate',
  );
}
if (!WORKSHOP_PRICING_STRUCTURE?.sourceCitation) {
  failures.push('WORKSHOP_PRICING_STRUCTURE.sourceCitation is falsy, expected a non-null citation');
}
if (!/brad/i.test(String(WORKSHOP_PRICING_STRUCTURE?.sourceCitation ?? ''))) {
  failures.push(`WORKSHOP_PRICING_STRUCTURE.sourceCitation does not mention Brad: ${JSON.stringify(WORKSHOP_PRICING_STRUCTURE?.sourceCitation)}`);
}

// The exact pre-mission WORKSHOP_FIELD_TRIP_PRODUCTS value, transcribed from
// lib/provisional-figures.ts before this feature touched the file. Any field drift here —
// added, removed, renamed, or re-valued — fails this check.
const EXPECTED_WORKSHOP_FIELD_TRIP_PRODUCTS = [
  {
    slug: 'sunset-cocktails-single',
    name: 'Sunset Cocktails (Single)',
    category: 'workshop-field-trip',
    description: 'Admission to the Sunset Cocktails evening reception. 18+ event.',
    price: 800,
    capacity: 200,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
    capacityPool: 'sunset-cocktails',
    headcountPerUnit: 1,
    sourceCitation: "Lee-Ann's 13.1 Ticketing system details.docx, line 305-314",
  },
  {
    slug: 'sunset-cocktails-couple',
    name: 'Sunset Cocktails (Couple)',
    category: 'workshop-field-trip',
    description: 'Admission to the Sunset Cocktails evening reception for two guests. 18+ event.',
    price: 1500,
    capacity: 200,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
    capacityPool: 'sunset-cocktails',
    headcountPerUnit: 2,
    sourceCitation: "Lee-Ann's 13.1 Ticketing system details.docx, line 305-314",
  },
  {
    slug: 'field-trip',
    name: 'Field Trip (per outing)',
    category: 'workshop-field-trip',
    description: 'Transport and entry for one guided field trip outing.',
    price: 200,
    capacity: 60,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
    capacityPool: 'field-trip',
    headcountPerUnit: 1,
    sourceCitation: "Lee-Ann's 13.1 Ticketing system details.docx, line 158-162",
  },
];

if (JSON.stringify(WORKSHOP_FIELD_TRIP_PRODUCTS) !== JSON.stringify(EXPECTED_WORKSHOP_FIELD_TRIP_PRODUCTS)) {
  failures.push(
    'WORKSHOP_FIELD_TRIP_PRODUCTS changed — expected byte-unchanged. ' +
      `Actual: ${JSON.stringify(WORKSHOP_FIELD_TRIP_PRODUCTS)}`,
  );
}

if (failures.length > 0) {
  console.error('FAIL: check-workshop-session-pricing.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: WORKSHOP_SESSION_PRICE (100) / WORKSHOP_SESSION_CAPACITY (10) are real and ' +
    'Brad-sourced, WORKSHOP_PRICING_STRUCTURE carries the same figures, and ' +
    'WORKSHOP_FIELD_TRIP_PRODUCTS is byte-unchanged.',
);
