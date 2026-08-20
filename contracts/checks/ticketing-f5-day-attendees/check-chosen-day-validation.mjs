// A4 — isValidChosenDay() (lib/show-window-lookup.ts, F1 of this contract) must accept only
// days strictly within [window.startDate's calendar day, window.endDate's calendar day],
// inclusive of both boundary days, and reject malformed input outright.
//
// THE DEFECT CLASS THIS TARGETS
// Off-by-one at either edge: an implementation that excludes the startDate's OWN day (e.g.
// comparing `chosenDay > startDate` instead of `>=`) would silently refuse the very first day
// of the show to every buyer, and one that includes the day AFTER endDate would let a buyer
// book a day the show isn't running. Both fixed and buggy versions "mostly work" for days in
// the middle of the range, so this check pins both boundaries explicitly, plus one day
// on either side of them.
//
// This check imports a function that does not exist on the current tree — expected to fail
// with a module-resolution error until @dev adds lib/show-window-lookup.ts's
// isValidChosenDay() export per this contract's brief.
//
// Run as: npx tsx contracts/checks/ticketing-f5-day-attendees/check-chosen-day-validation.mjs

import { isValidChosenDay } from '../../../lib/show-window-lookup.ts';

const failures = [];

function check(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Deliberately synthetic, far-future window — never the real placeholder range.
const window = {
  startDate: new Date('2099-03-10T00:00:00.000Z'),
  endDate: new Date('2099-03-13T00:00:00.000Z'),
};

// (1) A day strictly inside the window.
check('(1) day strictly inside window', isValidChosenDay('2099-03-11', window), true);

// (2) The startDate's OWN calendar day — must be VALID (inclusive lower boundary).
check('(2) startDate day itself is valid', isValidChosenDay('2099-03-10', window), true);

// (3) The endDate's OWN calendar day — must be VALID (inclusive upper boundary).
check('(3) endDate day itself is valid', isValidChosenDay('2099-03-13', window), true);

// (4) CORE DEFECT: the day immediately BEFORE startDate must be rejected.
check('(4) CORE DEFECT: day before startDate is rejected', isValidChosenDay('2099-03-09', window), false);

// (5) CORE DEFECT: the day immediately AFTER endDate must be rejected.
check('(5) CORE DEFECT: day after endDate is rejected', isValidChosenDay('2099-03-14', window), false);

// (6) A syntactically valid but far-outside date must be rejected.
check('(6) far-outside date is rejected', isValidChosenDay('2050-01-01', window), false);

// (7) Malformed strings must be rejected, not thrown/crash.
for (const malformed of ['', 'not-a-date', '2099/03/11', '2099-3-11', '2099-03-11T00:00:00Z']) {
  check(`(7) malformed '${malformed}' rejected`, isValidChosenDay(malformed, window), false);
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: isValidChosenDay() correctly includes both window boundaries, rejects the day immediately outside either edge, and rejects malformed input.');
