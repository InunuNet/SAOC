// F2 (ticketing-complete, M1) — Codex GPT-5.5 review (2026-09-08) found that
// scripts/seed-ticketing.ts's buildTicketTypeDoc() enumerated every ticketType field
// explicitly and did NOT include the new `sourceCitation` field added to
// ProvisionalAdmissionProduct — the string 'sourceCitation' appeared nowhere in that file.
//
// THE DEFECT THIS TARGETS
// lib/provisional-figures.ts carries real, cited figures (Sunset Cocktails R800/R1500,
// Field Trip R200) with `sourceCitation` pointing at Lee-Ann's source document, specifically
// to make "we were told this" mechanically distinguishable from "we guessed" (see
// f2-provisional-figures-decisions.json). If the seed script drops the field when building
// the Sanity document, anyone running the normal seeder gets documents that look identical
// to a real, cited figure and a fabricated one — provenance lost silently, no error, no
// visible symptom. That is the same failure shape as inventing a number outright, arrived
// at by omission instead of invention. This check exists so the NEXT field ever added to
// ProvisionalAdmissionProduct can't be dropped by buildTicketTypeDoc the same way undetected
// — see the "any field with a non-null value" pass below, not just sourceCitation by name.
//
// HOW THIS OBSERVES THE REAL MECHANISM, NOT SOURCE TEXT
// Mirrors contracts/checks/ticketing-purchase-pages-f3/check-seed-category-field.mjs exactly:
// imports the real, exported, pure `buildTicketTypeDoc(product, index, showId)` and calls it
// against every real product object, asserting the RETURNED document's `sourceCitation`
// field equals the product's `sourceCitation` (or is `null` when the product has none) — a
// grep for the string "sourceCitation" in the source would be satisfied by a comment; this
// executes the actual doc-building logic and inspects its output.
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-seed-source-citation-field.mjs

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
  console.error('FAIL: check-seed-source-citation-field.mjs');
  console.error(
    '  - scripts/seed-ticketing.ts failed to import cleanly. It must have zero top-level ' +
      'side effects so buildTicketTypeDoc is safely importable in isolation. Import error:'
  );
  console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

if (typeof buildTicketTypeDoc !== 'function') {
  console.error('FAIL: check-seed-source-citation-field.mjs');
  console.error("  - scripts/seed-ticketing.ts does not export a 'buildTicketTypeDoc' function.");
  process.exit(1);
}

const ALL_PRODUCTS = [
  ...ADMISSION_PRODUCTS.map((p) => ({ groupName: 'ADMISSION_PRODUCTS', product: p })),
  ...CONFERENCE_PRODUCTS.map((p) => ({ groupName: 'CONFERENCE_PRODUCTS', product: p })),
  ...WORKSHOP_FIELD_TRIP_PRODUCTS.map((p) => ({ groupName: 'WORKSHOP_FIELD_TRIP_PRODUCTS', product: p })),
];

// At least one real product must carry a non-null sourceCitation, or this check would pass
// vacuously (every product null-to-null) without ever proving a REAL citation round-trips.
const productsWithCitation = ALL_PRODUCTS.filter(({ product }) => product.sourceCitation != null);
if (productsWithCitation.length === 0) {
  failures.push(
    'no product in ADMISSION_PRODUCTS/CONFERENCE_PRODUCTS/WORKSHOP_FIELD_TRIP_PRODUCTS carries ' +
      'a non-null sourceCitation — this check cannot prove a real citation round-trips without one'
  );
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

  const expected = product.sourceCitation ?? null;
  const actual = doc.sourceCitation;

  if (actual === undefined) {
    failures.push(
      `${groupName} entry '${product.slug}': built doc has no 'sourceCitation' key at all ` +
        `(expected ${JSON.stringify(expected)}) — the field was dropped by buildTicketTypeDoc`
    );
  } else if (actual !== expected) {
    failures.push(
      `${groupName} entry '${product.slug}': built doc sourceCitation is ${JSON.stringify(actual)}, ` +
        `expected ${JSON.stringify(expected)}`
    );
  }
});

if (failures.length > 0) {
  console.error('FAIL: check-seed-source-citation-field.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: scripts/seed-ticketing.ts round-trips sourceCitation (including at least one real, ' +
    'non-null citation) onto every built ticketType document.'
);
