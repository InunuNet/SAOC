// F3 (ticketing-conferences-and-events, M2) — defect-repair pass 2 (Codex GPT-5.5 cross-model
// review, 2026-08-21) — proves scripts/seed-ticketing.ts actually WRITES `category` onto every
// ticketType document it creates, not just that lib/provisional-figures.ts carries the field
// (that's A1's job) or that the query can read it (A11's job).
//
// THE DEFECT THIS TARGETS
// A1 proves every product literal in lib/provisional-figures.ts HAS a `category` field. A11/A13
// prove the query and page CAN read a `category` field once one exists on a Sanity document.
// Neither proves the seed script actually COPIES product.category onto the document it creates.
// Codex's second-pass review found exactly this gap: scripts/seed-ticketing.ts's
// client.createIfNotExists({...}) object literal spreads every other product field
// (name/price/description/capacity/provisional/earlyBirdCutoff/releasedQuantity/
// requiresDaySelection/requiresAttendeeNames) but never writes `category: product.category`.
// Every FRESH conference/workshop-field-trip document seeded from here on would be created with
// no `category` field at all — genuinely invisible on /national-show/conferences and
// /national-show/workshops forever (those pages have no admission-only fallback to catch them,
// see A11's "admission-only, not category-agnostic" design decision). This is a permanent gap
// in the seed path itself, not a one-time migration-timing gap (that was the FIRST defect,
// already repaired by A11/A12/A13).
//
// HOW THIS OBSERVES THE REAL MECHANISM, NOT SOURCE TEXT
// It imports the real, exported `buildTicketTypeDoc(product, index, showId)` function from
// scripts/seed-ticketing.ts (a pure, side-effect-free function — env reading and Sanity client
// construction happen only inside main(), never at module top level, specifically so this
// function is safely importable without .env.local or network access) and calls it against
// every one of the 15 real product objects from lib/provisional-figures.ts, asserting the
// RETURNED document object's `category` field is defined and exactly equals `product.category`.
// A grep for the string "category" in the source would be satisfied by a comment or an unrelated
// reference — this instead executes the actual doc-building logic and inspects its output.
//
// Run as: npx tsx contracts/checks/ticketing-purchase-pages-f3/check-seed-category-field.mjs

import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
} from '../../../lib/provisional-figures.ts';

const failures = [];
const FAKE_SHOW_ID = 'show-fake-for-check';

let buildTicketTypeDoc;
try {
  ({ buildTicketTypeDoc } = await import('../../../scripts/seed-ticketing.ts'));
} catch (err) {
  console.error('FAIL: check-seed-category-field.mjs');
  console.error(
    '  - scripts/seed-ticketing.ts failed to import cleanly. It must have zero top-level ' +
      'side effects (no .env.local read, no Sanity client construction) so buildTicketTypeDoc ' +
      'is safely importable in isolation — move that setup inside main(). Import error:'
  );
  console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

if (typeof buildTicketTypeDoc !== 'function') {
  console.error('FAIL: check-seed-category-field.mjs');
  console.error(
    '  - scripts/seed-ticketing.ts does not export a `buildTicketTypeDoc` function. ' +
      'seedTicketTypes() must build each document via this exported, pure function instead of ' +
      'an inline object literal, so the doc-building logic can be verified in isolation.'
  );
  process.exit(1);
}

const ALL_PRODUCTS = [
  ...ADMISSION_PRODUCTS.map((p) => ({ groupName: 'ADMISSION_PRODUCTS', product: p })),
  ...CONFERENCE_PRODUCTS.map((p) => ({ groupName: 'CONFERENCE_PRODUCTS', product: p })),
  ...WORKSHOP_FIELD_TRIP_PRODUCTS.map((p) => ({ groupName: 'WORKSHOP_FIELD_TRIP_PRODUCTS', product: p })),
];

if (ALL_PRODUCTS.length !== 15) {
  failures.push(`expected 15 total products across the three arrays, got ${ALL_PRODUCTS.length}`);
}

ALL_PRODUCTS.forEach(({ groupName, product }, index) => {
  let doc;
  try {
    doc = buildTicketTypeDoc(product, index, FAKE_SHOW_ID);
  } catch (err) {
    failures.push(
      `${groupName} entry '${product.slug}': buildTicketTypeDoc threw: ${err instanceof Error ? err.message : String(err)}`
    );
    return;
  }
  if (doc == null || typeof doc !== 'object') {
    failures.push(`${groupName} entry '${product.slug}': buildTicketTypeDoc did not return an object`);
    return;
  }
  if (doc.category === undefined) {
    failures.push(
      `${groupName} entry '${product.slug}': built doc has no 'category' field at all ` +
        `(expected '${product.category}')`
    );
  } else if (doc.category !== product.category) {
    failures.push(
      `${groupName} entry '${product.slug}': built doc category is ${JSON.stringify(doc.category)}, ` +
        `expected ${JSON.stringify(product.category)}`
    );
  }
  // Sanity check that this is really the same doc-building path A1-A13 rely on elsewhere —
  // a stubbed function that only sets `category` and nothing else would trivially "pass" a
  // category-only check without being the real seed logic.
  if (doc._id !== `ticketType-${product.slug}`) {
    failures.push(
      `${groupName} entry '${product.slug}': built doc _id is ${JSON.stringify(doc._id)}, ` +
        `expected 'ticketType-${product.slug}' — this does not look like the real seed doc-builder`
    );
  }
});

if (failures.length > 0) {
  console.error('FAIL: check-seed-category-field.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: scripts/seed-ticketing.ts writes the correct category field onto all 15 built docs.');
