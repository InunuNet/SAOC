// F2 (ticketing-complete, M1) defect repair — Codex GPT-5.5 cross-model FAIL, 2026-09-08.
//
// THE DEFECT THIS TARGETS
// lib/provisional-figures.ts's VIP entry set `earlyBirdCutoff: EARLY_BIRD_CUTOFF` — the
// legacy shared constant '2027-07-31'. That date has no relationship to this mission's
// confirmed rule (90 days before the confirmed 2027-09-16 show start = 2027-06-18). VIP's
// cutoff is being freshly WRITTEN under Brad's 2026-09-08 ruling, not preserved as a legacy
// value, so carrying the legacy constant sells VIP at the R500 early-bird price for 43 days
// past the real cutoff once migrated.
//
// WHY THE PRE-EXISTING CHECK MISSED IT
// check-vip-computed-early-bird-price.mjs proves the ENGINE returns the right numbers for
// VIP's base price. It never inspects the cutoff DATE stored on the product — so it passed
// green with the wrong date stored. Satisfiable without the property holding: this repo's
// own audited defect class.
//
// THE PROPERTY THIS PROVES (one property, independently falsifiable)
// ADMISSION_PRODUCTS's `vip` entry's `earlyBirdCutoff` equals the value the REAL engine
// derives from the confirmed show start — computed here by calling
// deriveAdmissionEarlyBirdCutoffIso(), never by comparing against a hardcoded '2027-06-18'
// literal. A second hand-typed copy of the date would let this check and the source silently
// agree on a wrong value; deriving it means they cannot.
//
// NEGATIVE CONTROL
// Reverting VIP's field to EARLY_BIRD_CUTOFF must turn this check RED. The explicit
// inequality assertion below is what makes that true and observable, and it is guarded by
// first pinning EARLY_BIRD_CUTOFF itself to '2027-07-31' — if that legacy constant were ever
// changed to the derived date, the inequality would be meaningless rather than merely wrong.
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-vip-stored-cutoff-derived.mjs

import { deriveAdmissionEarlyBirdCutoffIso } from '../../../lib/admission-early-bird-pricing.ts';
import { ADMISSION_PRODUCTS, EARLY_BIRD_CUTOFF } from '../../../lib/provisional-figures.ts';

const failures = [];

// The real live show-19-2027 start instant, matching
// goldens/fixtures/f1-pricing-boundary-cases.json's showStartDateIso verbatim and the
// SHOW_START_DATE used by check-vip-computed-early-bird-price.mjs.
const SHOW_START_DATE = new Date('2027-09-16T07:00:00Z');

// The bare YYYY-MM-DD shape every `earlyBirdCutoff` field in this module uses, and the shape
// isWithinEarlyBirdWindow() — the comparator that actually gates VIP's runtime price — expects.
const EXPECTED_CUTOFF = deriveAdmissionEarlyBirdCutoffIso(SHOW_START_DATE).slice(0, 10);

const LEGACY_CUTOFF = '2027-07-31';

const vip = ADMISSION_PRODUCTS.find((p) => p.slug === 'vip');
if (!vip) {
  console.error('FAIL: check-vip-stored-cutoff-derived.mjs');
  console.error("  - no 'vip' entry in ADMISSION_PRODUCTS");
  process.exit(1);
}

// Guard that the negative control below is meaningful: the legacy constant must still be the
// legacy date. Weekend Pass and the three conference early-bird SKUs deliberately still carry
// it (an open decision for Brad — see docs/ticketing-complete-f2-open-decisions.md §3), so it
// must not have been quietly repointed at the derived date as a shortcut resolution.
if (EARLY_BIRD_CUTOFF !== LEGACY_CUTOFF) {
  failures.push(
    `EARLY_BIRD_CUTOFF is ${JSON.stringify(EARLY_BIRD_CUTOFF)}, expected ${JSON.stringify(LEGACY_CUTOFF)} — ` +
      'the legacy constant must stay put; repointing it silently resolves the open ' +
      'weekend-pass/conference cutoff decision that is Brad\'s to make'
  );
}

if (vip.earlyBirdCutoff !== EXPECTED_CUTOFF) {
  failures.push(
    `vip.earlyBirdCutoff is ${JSON.stringify(vip.earlyBirdCutoff)}, expected ` +
      `${JSON.stringify(EXPECTED_CUTOFF)} — the value deriveAdmissionEarlyBirdCutoffIso() ` +
      `computes from the confirmed show start ${SHOW_START_DATE.toISOString()} ` +
      '(90 days before 2027-09-16)'
  );
}

// Negative control, stated as its own assertion so the legacy-constant regression is named
// explicitly in the gate log rather than only implied by the equality failure above.
if (vip.earlyBirdCutoff === EARLY_BIRD_CUTOFF) {
  failures.push(
    `vip.earlyBirdCutoff is still the legacy EARLY_BIRD_CUTOFF constant ` +
      `(${JSON.stringify(EARLY_BIRD_CUTOFF)}) — VIP's cutoff is freshly written under Brad's ` +
      '2026-09-08 ruling and must carry the derived 90-day cutoff, not the legacy date'
  );
}

if (failures.length > 0) {
  console.error('FAIL: check-vip-stored-cutoff-derived.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `PASS: ADMISSION_PRODUCTS's VIP entry stores earlyBirdCutoff ${EXPECTED_CUTOFF}, derived by ` +
    'the real deriveAdmissionEarlyBirdCutoffIso() engine from the confirmed 2027-09-16 show ' +
    `start — not the legacy EARLY_BIRD_CUTOFF constant (${EARLY_BIRD_CUTOFF}), which remains ` +
    'in place for the products whose cutoff is still an open decision.'
);
