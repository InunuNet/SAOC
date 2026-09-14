// F2 (ticketing-complete, M1) defect repair — Codex GPT-5.5 cross-model FAIL, 2026-09-08.
// This is the GAP-CLOSING check: it inspects what the MIGRATION WRITES, which nothing else did.
//
// THE GAP THIS CLOSES
// check-vip-computed-early-bird-price.mjs proves the pricing ENGINE returns the right numbers.
// check-vip-stored-cutoff-derived.mjs proves the SOURCE MODULE stores the right cutoff. Neither
// says anything about the op scripts/migrate-f2-ticket-taxonomy.ts actually plans to write into
// the live Sanity dataset — and that op's `fields.earlyBirdCutoff` is what
// lib/checkout-reservation.ts's resolveEffectivePrice() reads at checkout time to decide
// whether a buyer pays R500 or R625. A wrong date there sells VIP at the early-bird price for
// 43 days past the confirmed cutoff. Proving the source and proving the write are two different
// properties; this check is the second one.
//
// THE PROPERTY THIS PROVES
// buildMigrationPlan()'s `price-patch` op for `ticketType-vip` sets `earlyBirdCutoff` to the
// value the REAL engine derives from the confirmed show start — computed here via
// deriveAdmissionEarlyBirdCutoffIso(), never a hardcoded '2027-06-18' literal. Also
// regression-guards the rest of Brad's 2026-09-08 ruling on that same op (price 500,
// regularPrice 625, provisional false), since all four fields are written together in one
// patch and a partial application is the failure mode this migration exists to avoid.
//
// SAFETY
// buildMigrationPlan() is pure and I/O-free given a showId — no network, no Sanity client, no
// credentials, and this check never reaches the --apply path. The showId argument is consumed
// only by the unrelated field-trip `create` op's `show` reference, so a dummy value is
// correct here rather than merely convenient.
//
// HOW THIS OBSERVES THE REAL MECHANISM
// Imports and calls the real exported buildMigrationPlan() and reads the op object it returns
// — not a grep of the script's source text, which its own comments could satisfy without the
// field ever being set.
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-vip-migration-plan-cutoff.mjs

import { deriveAdmissionEarlyBirdCutoffIso } from '../../../lib/admission-early-bird-pricing.ts';
import { buildMigrationPlan } from '../../../scripts/migrate-f2-ticket-taxonomy.ts';

const failures = [];

const SHOW_START_DATE = new Date('2027-09-16T07:00:00Z');
const EXPECTED_CUTOFF = deriveAdmissionEarlyBirdCutoffIso(SHOW_START_DATE).slice(0, 10);

// Never the real active show id: this check must never be mistakable for a live-data path.
const DUMMY_SHOW_ID = 'CONTRACT_CHECK_DUMMY_SHOW_ID';

const VIP_OP_ID = 'ticketType-vip';

let plan;
try {
  plan = buildMigrationPlan(DUMMY_SHOW_ID);
} catch (err) {
  console.error('FAIL: check-vip-migration-plan-cutoff.mjs');
  console.error(`  - buildMigrationPlan('${DUMMY_SHOW_ID}') threw: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

if (!Array.isArray(plan)) {
  console.error('FAIL: check-vip-migration-plan-cutoff.mjs');
  console.error(`  - buildMigrationPlan() returned ${JSON.stringify(plan)}, expected an array of ops`);
  process.exit(1);
}

const vipPricePatches = plan.filter((op) => op.kind === 'price-patch' && op.id === VIP_OP_ID);

if (vipPricePatches.length !== 1) {
  console.error('FAIL: check-vip-migration-plan-cutoff.mjs');
  console.error(
    `  - expected exactly 1 price-patch op with id '${VIP_OP_ID}', found ${vipPricePatches.length}. ` +
      `Plan op ids: ${JSON.stringify(plan.map((op) => `${op.kind}:${op.id}`))}`
  );
  process.exit(1);
}

const fields = vipPricePatches[0].fields;
if (!fields || typeof fields !== 'object') {
  console.error('FAIL: check-vip-migration-plan-cutoff.mjs');
  console.error(`  - the '${VIP_OP_ID}' price-patch op carries no fields object: ${JSON.stringify(fields)}`);
  process.exit(1);
}

// The whole point of this check.
if (fields.earlyBirdCutoff !== EXPECTED_CUTOFF) {
  failures.push(
    `migration plan would write earlyBirdCutoff = ${JSON.stringify(fields.earlyBirdCutoff)} to ` +
      `${VIP_OP_ID}, expected ${JSON.stringify(EXPECTED_CUTOFF)} (derived by the real engine ` +
      'from the confirmed 2027-09-16 show start). resolveEffectivePrice() reads this stored ' +
      'field directly at checkout, so a wrong date here sells VIP at the early-bird price ' +
      'past the real cutoff.'
  );
}

// Regression guard on the rest of the same ruling, written in the same patch.
const EXPECTED_RULING_FIELDS = {
  price: 500,
  regularPrice: 625,
  provisional: false,
};
for (const [field, expected] of Object.entries(EXPECTED_RULING_FIELDS)) {
  if (fields[field] !== expected) {
    failures.push(
      `migration plan would write ${field} = ${JSON.stringify(fields[field])} to ${VIP_OP_ID}, ` +
        `expected ${JSON.stringify(expected)} per Brad's 2026-09-08 ruling`
    );
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-vip-migration-plan-cutoff.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `PASS: buildMigrationPlan()'s '${VIP_OP_ID}' price-patch op would write earlyBirdCutoff ` +
    `${EXPECTED_CUTOFF} (engine-derived, not a re-typed literal), price 500, regularPrice 625, ` +
    'provisional false — so the value resolveEffectivePrice() reads at checkout after the ' +
    "migration matches the confirmed 90-day cutoff, not the legacy constant."
);
