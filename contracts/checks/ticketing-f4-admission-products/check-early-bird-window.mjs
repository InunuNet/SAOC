// A5 — isWithinEarlyBirdWindow() (lib/checkout-reservation.ts, F4 of this contract) must gate on
// the END of the cutoff date, not exact-millisecond comparison against midnight, and must never
// restrict a ticket type that carries no cutoff at all.
//
// THE DEFECT CLASS THIS TARGETS
// A naive `now <= new Date(cutoffIso)` comparison parses '2027-07-31' as midnight UTC
// 2027-07-31T00:00:00.000Z, so it closes early-bird sales at the START of the cutoff date instead
// of the end of it — a buyer purchasing at 09:00 on the cutoff date itself would be wrongly
// refused. The correct comparison must hold through the entire cutoff day.
//
// This check imports a function that does not exist on the current tree — expected to fail with
// a module-resolution error until @dev adds lib/checkout-reservation.ts's
// isWithinEarlyBirdWindow() export per this contract's brief.
//
// Run as: npx tsx contracts/checks/ticketing-f4-admission-products/check-early-bird-window.mjs

import { isWithinEarlyBirdWindow } from '../../../lib/checkout-reservation.ts';

const failures = [];

function check(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${expected}, got ${actual}`);
  }
}

const CUTOFF = '2027-07-31';

// (1) No cutoff at all (null) -> always open, regardless of `now`. Weekend Pass/VIP/Day Visitor
// never carry a cutoff and must never be accidentally gated by this function.
check(
  '(1) null cutoff is always within window',
  isWithinEarlyBirdWindow(new Date('2099-01-01T00:00:00Z'), null),
  true
);

// (2) No cutoff at all (undefined) -> same as null.
check(
  '(2) undefined cutoff is always within window',
  isWithinEarlyBirdWindow(new Date('2099-01-01T00:00:00Z'), undefined),
  true
);

// (3) Well before cutoff -> within window.
check(
  '(3) well before cutoff',
  isWithinEarlyBirdWindow(new Date('2027-01-15T12:00:00Z'), CUTOFF),
  true
);

// (4) CORE DEFECT: purchase attempt DURING the cutoff date itself must still succeed. A naive
// exact-midnight comparison closes the window at the START of 2027-07-31, not the end of it.
check(
  '(4) CORE DEFECT: still within window during the cutoff date itself (09:00 on 2027-07-31)',
  isWithinEarlyBirdWindow(new Date('2027-07-31T09:00:00Z'), CUTOFF),
  true
);

// (5) Late on the cutoff date (23:59) -> still within window.
check(
  '(5) still within window at 23:59 on the cutoff date',
  isWithinEarlyBirdWindow(new Date('2027-07-31T23:59:00Z'), CUTOFF),
  true
);

// (6) The day AFTER the cutoff -> window has closed.
check(
  '(6) window closed the day after cutoff',
  isWithinEarlyBirdWindow(new Date('2027-08-01T00:00:01Z'), CUTOFF),
  false
);

// (7) Well after cutoff -> window closed.
check(
  '(7) well after cutoff',
  isWithinEarlyBirdWindow(new Date('2027-09-16T00:00:00Z'), CUTOFF),
  false
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: isWithinEarlyBirdWindow() holds through the full cutoff date and never gates an unset cutoff.');
