#!/usr/bin/env node
// Regression proof that app/api/tickets/checkout/route.ts's ticketTypeMatchesActiveShow()
// is untouched by this feature: it must still reject every ticket type when
// activeShowId is null (the exact "two shows marked active" outage this Studio guard
// exists to make less likely, and the "zero shows active" state this contract's
// decision record explicitly leaves as a 500 — see README "Zero active shows: 500 is
// deliberately unchanged"). This feature does not modify route.ts at all; this check
// exists so a future PR that touches it cannot silently regress this gate alongside an
// unrelated change without failing this contract too.
//
// Run as: npx tsx
//   contracts/checks/production-blockers-f3-studio-active-show-guard/check-checkout-gate-unchanged.mjs
//
// npx tsx, NOT `node --import tsx/esm`: route.ts uses `@/` tsconfig-path aliases (e.g.
// `@/lib/show-resolution`), which the tsx CLI resolves via tsconfig but the
// `--import tsx/esm` loader hook does not for a nested import chain. See
// contracts/checks/ticketing-f1-show-collision/check-checkout-active-show-gate.mjs's
// header comment, which hit this exact issue first.

import { ticketTypeMatchesActiveShow } from '../../../app/api/tickets/checkout/route.ts';

const failures = [];

// No active show at all (zero, or ambiguous two-active collapsed to null upstream by
// resolveActiveShow) — every ticket type must be rejected, never matched by accident.
if (ticketTypeMatchesActiveShow({ _id: 'ticketType-adult', show: { _ref: 'show-19-2027' } }, null) !== false) {
  failures.push('activeShowId=null must reject a ticket type that references a real show id');
}

// A ticket type predating the show reference field (no `show` at all) — must reject.
if (ticketTypeMatchesActiveShow({ _id: 'ticketType-legacy' }, 'show-19-2027') !== false) {
  failures.push('a ticket type with no show reference must be rejected even with a valid activeShowId');
}

// The one case that must still pass: ticket type's show matches the resolved active show.
if (
  ticketTypeMatchesActiveShow({ _id: 'ticketType-adult', show: { _ref: 'show-19-2027' } }, 'show-19-2027') !==
  true
) {
  failures.push('a ticket type whose show matches the active show id must be accepted');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: ticketTypeMatchesActiveShow() checkout gate is unchanged by the Studio guard.');
process.exit(0);
