// A13 — Codex GPT-5.5 cross-model finding (2026-08-20), F5 gap 1. resolveChosenDayForPosition()
// (lib/checkout-reservation.ts) must NULL a line item's chosenDay before it is ever persisted
// to a position, for any ticket type whose requiresDaySelection is not true — chosenDay is
// meaningful ONLY for day-selection types (contracts/golden/ticketing-f5-day-attendees/
// README.md, "chosenDay: request shape, storage, and validation": "a non-Day-Visitor line item
// that sends one is simply ignored downstream, never rejected for 'extra' data").
//
// THE DEFECT CLASS THIS TARGETS
// app/api/tickets/checkout/route.ts's reserveTicket() call currently maps every line item's
// chosenDay through the UNCONDITIONAL `lineItem.chosenDay ?? null` — it never consults
// requiresDaySelectionByType at all. A crafted/buggy request can attach an arbitrary chosenDay
// string to a non-day-selection line item (e.g. 'vip', 'weekend-pass') and have it persisted
// verbatim onto that position's Firestore document, contradicting this feature's own documented
// invariant. This check proves the pure function stripping decision in isolation; the sibling
// wiring check (check-chosen-day-persistence-wiring.sh) proves the route actually calls it.
//
// This check imports a function that does not exist on the current tree — expected to fail
// with a module-resolution error until @dev adds lib/checkout-reservation.ts's
// resolveChosenDayForPosition() export per this contract's brief.
//
// Run as: npx tsx contracts/checks/ticketing-f5-day-attendees/check-chosen-day-stripped-for-non-day-types.mjs

import { resolveChosenDayForPosition } from '../../../lib/checkout-reservation.ts';

const failures = [];

function check(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// (1) CORE DEFECT: a non-day-selection type carrying a chosenDay must have it stripped to null
// before persistence — this is the exact scenario a crafted request exploits today.
check(
  '(1) CORE DEFECT: requiresDaySelection=false strips a supplied chosenDay to null',
  resolveChosenDayForPosition('2099-01-02', false),
  null
);

// (2) A day-selection type keeps its supplied chosenDay unchanged.
check(
  '(2) requiresDaySelection=true keeps a supplied chosenDay',
  resolveChosenDayForPosition('2099-01-02', true),
  '2099-01-02'
);

// (3) A day-selection type with no chosenDay supplied (should already be blocked earlier in the
// route by the "day selection is required" 400 guard, but the pure function itself must not
// invent one) stays null.
check(
  '(3) requiresDaySelection=true with no chosenDay supplied stays null',
  resolveChosenDayForPosition(undefined, true),
  null
);

// (4) A non-day-selection type with no chosenDay supplied stays null (the ordinary, non-attack
// case must be unaffected).
check(
  '(4) requiresDaySelection=false with no chosenDay supplied stays null',
  resolveChosenDayForPosition(undefined, false),
  null
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: resolveChosenDayForPosition() nulls chosenDay for any non-day-selection type, and only that case.');
