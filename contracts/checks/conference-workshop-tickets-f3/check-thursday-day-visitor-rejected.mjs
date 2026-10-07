// F3 (conference-workshop-tickets, M2) — A24: a day-visitor-shaped ticket purchase for an
// excluded day (2027-09-23, Thursday) is rejected end to end against a REAL dry-run of the
// updated validation logic — not a type-check, not a grep. Exercises
// isChosenDayExcluded() (lib/checkout-reservation.ts), the one small pure helper the golden
// addendum specifies so this decision is directly unit-testable without mocking a Next.js
// request or a Sanity fetch — same convention as resolveChosenDayForPosition() (F5,
// ticketing-f5-day-attendees), whose own decision/wiring split this check mirrors (see
// check-excluded-days-checkout-rejection.mjs for the sibling wiring half).
//
// Run as: npx tsx contracts/checks/conference-workshop-tickets-f3/check-thursday-day-visitor-rejected.mjs
import { isChosenDayExcluded } from '../../../lib/checkout-reservation.ts';

const failures = [];

function check(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// (1) CORE CASE — Thursday is excluded for day-visitor's excludedDays: a purchase attempt
// for 2027-09-23 must be rejected.
check(
  "(1) Thursday (2027-09-23) is excluded when excludedDays is ['2027-09-23']",
  isChosenDayExcluded('2027-09-23', ['2027-09-23']),
  true,
);

// (2) A day day-visitor DOES sell (e.g. Friday) must NOT be rejected by this check.
check(
  "(2) Friday (2027-09-24) is NOT excluded when excludedDays is ['2027-09-23']",
  isChosenDayExcluded('2027-09-24', ['2027-09-23']),
  false,
);

// (3) A product with no excludedDays at all (e.g. vip, weekend-pass) must never be
// rejected by this check regardless of chosenDay — the "optional, defaults to no
// exclusion" invariant.
check(
  '(3) no excludedDays set (undefined) never excludes any day',
  isChosenDayExcluded('2027-09-23', undefined),
  false,
);
check(
  '(3b) no excludedDays set (null) never excludes any day',
  isChosenDayExcluded('2027-09-23', null),
  false,
);

// (4) No chosenDay supplied at all must never be treated as excluded (that failure mode is
// the pre-existing "day selection is required" 400, a different code path entirely).
check(
  '(4) no chosenDay supplied is never excluded by this function',
  isChosenDayExcluded(undefined, ['2027-09-23']),
  false,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: isChosenDayExcluded() correctly rejects Thursday (2027-09-23) for day-visitor-shaped excludedDays, and only that case.');
