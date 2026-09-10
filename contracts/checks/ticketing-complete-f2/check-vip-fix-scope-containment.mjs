// F2 (ticketing-complete, M1) defect repair — Codex GPT-5.5 cross-model FAIL, 2026-09-08.
// The SCOPE FENCE around that repair.
//
// WHY THIS EXISTS
// The VIP cutoff repair moves ONE product off the legacy EARLY_BIRD_CUTOFF constant
// ('2027-07-31') onto the engine-derived 90-day cutoff ('2027-06-18'). The tempting
// over-reach is to "fix" the weekend-pass SKUs at the same time, since they carry the same
// legacy date. That must NOT happen: `early-bird-weekend-pass`'s 2027-07-31 cutoff is a
// DELIBERATE open escalation to Brad (docs/ticketing-complete-f2-open-decisions.md §3), and
// that SKU has one real Firestore position at status 'paid' — a real customer's money.
// A migration that silently picks one of the two dates destroys the evidence a decision was
// ever needed, which is precisely what the open-decisions doc exists to prevent.
//
// THE PROPERTY THIS PROVES
// buildMigrationPlan()'s output contains NO price-patch op against `ticketType-weekend-pass`
// or `ticketType-early-bird-weekend-pass` that sets an `earlyBirdCutoff` field at all. Not
// "sets it to the right value" — sets it AT ALL. The correct migration behaviour for those
// two SKUs is to leave the field untouched so the mismatch stays visible for Brad.
//
// This is deliberately its own script with its own exit code, not a third assertion bolted
// onto check-vip-migration-plan-cutoff.mjs: it proves a containment property about DIFFERENT
// documents, and it must be able to go red on its own, with its own message, without the VIP
// checks also going red for reasons that have nothing to do with scope creep.
//
// SAFETY: pure call, no network, no credentials, never the --apply path (see the sibling
// check's SAFETY note).
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-vip-fix-scope-containment.mjs

import { buildMigrationPlan } from '../../../scripts/migrate-f2-ticket-taxonomy.ts';

const failures = [];

const DUMMY_SHOW_ID = 'CONTRACT_CHECK_DUMMY_SHOW_ID';

// The two SKUs whose cutoff is an OPEN decision for Brad, not this mission's to resolve.
const FENCED_OFF_IDS = ['ticketType-weekend-pass', 'ticketType-early-bird-weekend-pass'];

let plan;
try {
  plan = buildMigrationPlan(DUMMY_SHOW_ID);
} catch (err) {
  console.error('FAIL: check-vip-fix-scope-containment.mjs');
  console.error(`  - buildMigrationPlan('${DUMMY_SHOW_ID}') threw: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

if (!Array.isArray(plan)) {
  console.error('FAIL: check-vip-fix-scope-containment.mjs');
  console.error(`  - buildMigrationPlan() returned ${JSON.stringify(plan)}, expected an array of ops`);
  process.exit(1);
}

for (const op of plan) {
  if (op.kind !== 'price-patch') continue;
  if (!FENCED_OFF_IDS.includes(op.id)) continue;
  const fields = op.fields ?? {};
  if (Object.prototype.hasOwnProperty.call(fields, 'earlyBirdCutoff')) {
    failures.push(
      `price-patch op against ${op.id} sets earlyBirdCutoff = ` +
        `${JSON.stringify(fields.earlyBirdCutoff)}. That SKU's 2027-07-31 cutoff is a ` +
        "DELIBERATE open escalation to Brad (docs/ticketing-complete-f2-open-decisions.md §3), " +
        'and early-bird-weekend-pass has one real paid Firestore position. The VIP repair ' +
        'must not resolve, migrate, or change it — leave the field untouched.'
    );
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-vip-fix-scope-containment.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `PASS: buildMigrationPlan() plans no earlyBirdCutoff write against ${FENCED_OFF_IDS.join(' or ')} — ` +
    "the VIP cutoff repair is contained to VIP, and the weekend-pass cutoff mismatch stays " +
    "visible as an open decision for Brad rather than being silently migrated away."
);
