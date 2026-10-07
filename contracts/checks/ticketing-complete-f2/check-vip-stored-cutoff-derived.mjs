// F2 (ticketing-complete, M1) ORIGINAL — proved VIP's stored `earlyBirdCutoff` was the real,
// engine-DERIVED 90-day cutoff (from `deriveAdmissionEarlyBirdCutoffIso()`), not the legacy
// `EARLY_BIRD_CUTOFF` constant left over from an earlier design.
//
// SUPERSEDED (conference-workshop-tickets, M1/F2, 2026-10-07) — Brad's ticket news, verbatim,
// message 6 (.agent/memory/scratch/brad-ticket-news-2026-10-07.md) and Lee-Ann's sheet, line
// 19 (.agent/memory/scratch/leeann-notes-2026-10-07.md) replace the 2026-09-08 computed-
// discount ruling with a flat R300 figure — VIP has NO early-bird mechanism of any kind any
// more. The correct stored value is plain `null`, not the engine-derived date and not the
// legacy constant either. This check now proves the union of both negative controls instead
// of proving which one of the two VIP should carry.
//
// NEGATIVE CONTROLS: reverting VIP's `earlyBirdCutoff` to EITHER the engine-derived cutoff OR
// the legacy `EARLY_BIRD_CUTOFF` constant must turn this check RED — both are stated as their
// own explicit assertions below, not only implied by the `!== null` check, so the gate log
// names which one regressed.
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-vip-stored-cutoff-derived.mjs

import { deriveAdmissionEarlyBirdCutoffIso } from '../../../lib/admission-early-bird-pricing.ts';
import { ADMISSION_PRODUCTS, EARLY_BIRD_CUTOFF } from '../../../lib/provisional-figures.ts';

const failures = [];

// The real live show-19-2027 start instant, matching the fixture other checks in this
// directory already use, kept here only to compute the now-superseded derived cutoff for the
// negative control below — never re-hardcoded as a literal date.
const SHOW_START_DATE = new Date('2027-09-23T07:00:00Z');
const SUPERSEDED_DERIVED_CUTOFF = deriveAdmissionEarlyBirdCutoffIso(SHOW_START_DATE).slice(0, 10);

const LEGACY_CUTOFF = '2027-07-31';

const vip = ADMISSION_PRODUCTS.find((p) => p.slug === 'vip');
if (!vip) {
  console.error('FAIL: check-vip-stored-cutoff-derived.mjs');
  console.error("  - no 'vip' entry in ADMISSION_PRODUCTS");
  process.exit(1);
}

// Guard that the legacy-constant negative control below is meaningful: the legacy constant
// must still be the legacy date (other products — weekend-pass's old mechanism, the
// conference early-bird SKUs — may still reference it; whether they still should is a
// separate, unrelated open question this check does not adjudicate).
if (EARLY_BIRD_CUTOFF !== LEGACY_CUTOFF) {
  failures.push(
    `EARLY_BIRD_CUTOFF is ${JSON.stringify(EARLY_BIRD_CUTOFF)}, expected ${JSON.stringify(LEGACY_CUTOFF)} — ` +
      'the legacy constant must stay put for this negative control to mean anything'
  );
}

if (vip.earlyBirdCutoff !== null) {
  failures.push(
    `vip.earlyBirdCutoff is ${JSON.stringify(vip.earlyBirdCutoff)}, expected null — VIP has no early-bird ` +
      "mechanism of any kind (Brad's ticket news, 2026-10-07, message 6; Lee-Ann's sheet line 19)"
  );
}

// Negative controls, each its own named assertion rather than only implied by the equality
// failure above.
if (vip.earlyBirdCutoff === SUPERSEDED_DERIVED_CUTOFF) {
  failures.push(
    `vip.earlyBirdCutoff still carries the now-superseded engine-derived cutoff ` +
      `(${JSON.stringify(SUPERSEDED_DERIVED_CUTOFF)}) from the 2026-09-08 ruling this feature overrides`
  );
}
if (vip.earlyBirdCutoff === EARLY_BIRD_CUTOFF) {
  failures.push(
    `vip.earlyBirdCutoff still carries the legacy EARLY_BIRD_CUTOFF constant ` +
      `(${JSON.stringify(EARLY_BIRD_CUTOFF)}) — VIP has no date-cutoff mechanism of any kind any more`
  );
}

if (failures.length > 0) {
  console.error('FAIL: check-vip-stored-cutoff-derived.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  "PASS: ADMISSION_PRODUCTS's VIP entry stores earlyBirdCutoff null — neither the superseded " +
    `engine-derived cutoff (${SUPERSEDED_DERIVED_CUTOFF}) nor the legacy EARLY_BIRD_CUTOFF ` +
    `constant (${EARLY_BIRD_CUTOFF}) — VIP has no early-bird mechanism of any kind.`
);
