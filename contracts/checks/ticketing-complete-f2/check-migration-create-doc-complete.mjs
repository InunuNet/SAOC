// F2 (ticketing-complete, M1) — Codex GPT-5.5 review (2026-09-08) found that
// scripts/migrate-f2-ticket-taxonomy.ts's `create` op for the new flat-rate Field Trip
// product hand-rolled its own ticketType document object literal, and that hand-rolled copy
// had already drifted from the real seed builder: it omitted `slug` and `show` entirely.
//
// THE DEFECT THIS TARGETS
// ticketTypeBySlugQuery matches on `slug.current == $slug` — a document with no `slug` field
// never resolves there, so the purchase page can never find it. Checkout separately rejects
// any ticket type with no valid `show` reference. This is the one genuinely NEW product this
// migration creates: it would have looked correct in Studio's document list (name, price,
// description all present) and been completely unbuyable. check-seed-source-citation-field.mjs
// and check-seed-no-undefined-own-properties.mjs both prove properties of
// scripts/seed-ticketing.ts's builder; neither says anything about
// scripts/migrate-f2-ticket-taxonomy.ts's SEPARATE create-doc code path, which is exactly
// where this drifted.
//
// THE FIX THIS PROVES
// migrate-f2-ticket-taxonomy.ts now builds the create doc through the SAME exported,
// pure buildTicketTypeDoc() the real seeder uses (imported from scripts/seed-ticketing.ts),
// rather than a second hand-rolled literal — so this document can never drift from the
// seeder's field set again. This check proves the create op's document carries `slug` and
// `show` at minimum (the two fields that were actually missing), and — since it is now built
// via buildTicketTypeDoc — reuses the same "no undefined own-property, no missing key" shape
// as check-seed-no-undefined-own-properties.mjs, applied to this ONE document.
//
// HOW THIS OBSERVES THE REAL MECHANISM, NOT SOURCE TEXT
// Imports the real, exported, pure `buildMigrationPlan(showId)` and finds the `create`-kind
// op in its returned plan, then inspects the actual document object it carries — not a grep
// for the string "slug" (which the removed hand-rolled version's comments could have
// contained without ever setting the field).
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-migration-create-doc-complete.mjs

import { buildMigrationPlan } from '../../../scripts/migrate-f2-ticket-taxonomy.ts';

const failures = [];
const FAKE_SHOW_ID = 'show-fake-for-check';

let plan;
try {
  plan = buildMigrationPlan(FAKE_SHOW_ID);
} catch (err) {
  console.error('FAIL: check-migration-create-doc-complete.mjs');
  console.error(`  - buildMigrationPlan() threw: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

if (!Array.isArray(plan)) {
  console.error('FAIL: check-migration-create-doc-complete.mjs');
  console.error('  - buildMigrationPlan() did not return an array');
  process.exit(1);
}

const createOps = plan.filter((op) => op?.kind === 'create');

if (createOps.length !== 1) {
  failures.push(`expected exactly 1 'create' op in the migration plan, got ${createOps.length}`);
}

for (const op of createOps) {
  const doc = op.doc;
  if (doc == null || typeof doc !== 'object') {
    failures.push(`create op '${op.id}': doc is not an object`);
    continue;
  }

  if (!Object.prototype.hasOwnProperty.call(doc, 'slug')) {
    failures.push(`create op '${op.id}': doc is missing 'slug' entirely — will never resolve via ticketTypeBySlugQuery`);
  } else if (doc.slug?.current == null || doc.slug.current === '') {
    failures.push(`create op '${op.id}': doc.slug.current is empty/missing (${JSON.stringify(doc.slug)})`);
  }

  if (!Object.prototype.hasOwnProperty.call(doc, 'show')) {
    failures.push(`create op '${op.id}': doc is missing 'show' entirely — checkout will reject a ticket type with no show reference`);
  } else if (doc.show?._ref !== FAKE_SHOW_ID) {
    failures.push(
      `create op '${op.id}': doc.show._ref is ${JSON.stringify(doc.show?._ref)}, expected the ` +
        `showId passed into buildMigrationPlan() (${JSON.stringify(FAKE_SHOW_ID)}) — the show ` +
        'reference is not actually threaded through from the caller'
    );
  }

  // No undefined own-properties anywhere on this document either — same guard as
  // check-seed-no-undefined-own-properties.mjs, applied here since this doc is now built by
  // the same shared builder.
  for (const [key, value] of Object.entries(doc)) {
    if (value === undefined) {
      failures.push(`create op '${op.id}': doc has an undefined own-property '${key}'`);
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-migration-create-doc-complete.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  "PASS: scripts/migrate-f2-ticket-taxonomy.ts's create op produces a document with a real " +
    'slug and show reference (and no undefined own-properties).'
);
