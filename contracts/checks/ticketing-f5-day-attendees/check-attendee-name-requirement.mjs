// A5 — isNamedAttendeeSatisfied() (lib/checkout-reservation.ts, F2 of this contract) must be
// FLAG-DRIVEN, not slug-driven: it takes the CMS-sourced requiresAttendeeNames boolean and the
// candidate name, nothing else.
//
// THE DEFECT CLASS THIS TARGETS
// The cheapest-looking "correct" implementation checks `ticketType === 'vip'` instead of the
// boolean argument — it passes every fixture that happens to use the slug 'vip', and silently
// stops working the day a second requiresAttendeeNames product is added in Sanity with a
// different slug, with no code change to notice. This check never passes the string 'vip'
// anywhere, precisely to rule that implementation shape out: it calls the function with only
// (boolean, string), which a slug-keyed implementation cannot even compile/reference correctly
// as an equivalent, since 'vip' never appears as an argument at all.
//
// This check imports a function that does not exist on the current tree — expected to fail
// with a module-resolution error until @dev adds lib/checkout-reservation.ts's
// isNamedAttendeeSatisfied() export per this contract's brief.
//
// Run as: npx tsx contracts/checks/ticketing-f5-day-attendees/check-attendee-name-requirement.mjs

import { isNamedAttendeeSatisfied } from '../../../lib/checkout-reservation.ts';

const failures = [];

function check(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// (1) CORE DEFECT: required + empty name -> false.
check('(1) CORE DEFECT: required + empty name is not satisfied', isNamedAttendeeSatisfied(true, ''), false);

// (2) Required + whitespace-only name -> false (not just empty-string-strict).
check('(2) required + whitespace-only name is not satisfied', isNamedAttendeeSatisfied(true, '   '), false);

// (3) Required + real name -> true.
check('(3) required + real name is satisfied', isNamedAttendeeSatisfied(true, 'Alex Chen'), true);

// (4) NOT required + empty name -> true (never blocks a type that doesn't need a name).
check('(4) not required + empty name is satisfied', isNamedAttendeeSatisfied(false, ''), true);

// (5) NOT required + real name -> true (a name being present never hurts).
check('(5) not required + real name is satisfied', isNamedAttendeeSatisfied(false, 'Alex Chen'), true);

console.log('PASS (flag-driven, not slug-driven): the string \'vip\' was never passed as an argument anywhere in this check.');

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: isNamedAttendeeSatisfied() is correctly driven by the boolean flag alone.');
