// F2 (ticketing-complete, M1) — generic guard for the CLAUDE.md builder rule ("Firestore
// builders: coalesce optionals or strip undefined ... must never leave `undefined`
// own-properties on the output"). Codex GPT-5.5's review of this feature's diff found
// buildTicketTypeDoc() had already dropped `sourceCitation` silently (fixed, see
// check-seed-source-citation-field.mjs); a follow-up sweep of the same builder found
// `regularPrice` (an existing OPTIONAL field on ProvisionalAdmissionProduct, set to 400 on
// the live `weekend-pass` product) was ALSO never referenced anywhere in the object literal
// — a pre-existing gap, not introduced by F2, but the exact "same shape, different field"
// hazard the team lead asked to close for the whole builder rather than one field at a time.
//
// THIS CHECK IS THE GENERIC GUARD, NOT A PER-FIELD ONE
// It builds a document for every real product (ADMISSION_PRODUCTS + CONFERENCE_PRODUCTS +
// WORKSHOP_FIELD_TRIP_PRODUCTS) and fails if ANY own-property of the returned object has the
// value `undefined` — the exact defect class CLAUDE.md's rule targets, regardless of which
// field name it shows up on next. A field entirely OMITTED from the object literal (like the
// regularPrice defect actually was) does not itself produce `undefined` — it produces a
// MISSING key, which `Object.values()` never sees — so this check also asserts the object
// carries every key `buildTicketTypeDoc` is documented to write (the fixed field list below),
// catching a fully-dropped key as well as a present-but-undefined one.
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-seed-no-undefined-own-properties.mjs

import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
} from '../../../lib/provisional-figures.ts';

const failures = [];
const FAKE_SHOW_ID = 'show-fake-for-check';

// The full field list buildTicketTypeDoc is documented to always write (present as a key,
// even when its value is `null`) — mirrors scripts/seed-ticketing.ts's own object literal.
const REQUIRED_KEYS = [
  '_id',
  '_type',
  'name',
  'slug',
  'price',
  'description',
  'capacity',
  'active',
  'order',
  'show',
  'provisional',
  'earlyBirdCutoff',
  'releasedQuantity',
  'requiresDaySelection',
  'requiresAttendeeNames',
  'category',
  'capacityPool',
  'headcountPerUnit',
  'regularPrice',
  'sourceCitation',
];

let buildTicketTypeDoc;
try {
  ({ buildTicketTypeDoc } = await import('../../../scripts/seed-ticketing.ts'));
} catch (err) {
  console.error('FAIL: check-seed-no-undefined-own-properties.mjs');
  console.error(`  - scripts/seed-ticketing.ts failed to import cleanly: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const ALL_PRODUCTS = [
  ...ADMISSION_PRODUCTS.map((p) => ({ groupName: 'ADMISSION_PRODUCTS', product: p })),
  ...CONFERENCE_PRODUCTS.map((p) => ({ groupName: 'CONFERENCE_PRODUCTS', product: p })),
  ...WORKSHOP_FIELD_TRIP_PRODUCTS.map((p) => ({ groupName: 'WORKSHOP_FIELD_TRIP_PRODUCTS', product: p })),
];

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

  for (const key of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(doc, key)) {
      failures.push(`${groupName} entry '${product.slug}': built doc is missing the '${key}' key entirely`);
    }
  }

  for (const [key, value] of Object.entries(doc)) {
    if (value === undefined) {
      failures.push(
        `${groupName} entry '${product.slug}': built doc has an undefined own-property '${key}' — ` +
          'coalesce to null or strip the key instead (CLAUDE.md builder rule)'
      );
    }
  }
});

if (failures.length > 0) {
  console.error('FAIL: check-seed-no-undefined-own-properties.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: buildTicketTypeDoc() writes every documented key on every product, with no ' +
    'undefined own-properties anywhere in the output.'
);
