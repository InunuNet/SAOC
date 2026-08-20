// A3 — computeShowDays() (lib/show-window-lookup.ts, F1 of this contract) must derive its
// ENTIRE output from the ShowWindow argument alone.
//
// THE DEFECT CLASS THIS TARGETS
// A day-picker that "looks done" the cheapest way is one seeded with a literal day list
// (hardcoded, or memoized from the first call) rather than actually computed from
// window.startDate/window.endDate every time. That would pass a single-fixture smoke test
// trivially. This check runs TWO disjoint, obviously-synthetic date ranges (never the real
// placeholder show-date range named in the golden README's "The blocker this is built around")
// through the same function and requires the outputs to differ — the negative control a
// single-fixture check cannot provide.
//
// This check imports a function that does not exist on the current tree — expected to fail
// with a module-resolution error until @dev adds lib/show-window-lookup.ts's
// computeShowDays() export per this contract's brief.
//
// Run as: npx tsx contracts/checks/ticketing-f5-day-attendees/check-day-list-from-window.mjs

import { computeShowDays } from '../../../lib/show-window-lookup.ts';

const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}: expected ${e}, got ${a}`);
}

// Deliberately synthetic, disjoint, far-future ranges — never the real placeholder range.
const windowA = {
  startDate: new Date('2099-01-01T00:00:00.000Z'),
  endDate: new Date('2099-01-04T00:00:00.000Z'),
};
const windowB = {
  startDate: new Date('2098-11-05T00:00:00.000Z'),
  endDate: new Date('2098-11-07T00:00:00.000Z'),
};

// (1) Exact inclusive day list for window A (4 days).
check(
  '(1) windowA exact inclusive day list',
  computeShowDays(windowA),
  ['2099-01-01', '2099-01-02', '2099-01-03', '2099-01-04']
);

// (2) Exact inclusive day list for window B (3 days, different range entirely).
check(
  '(2) windowB exact inclusive day list',
  computeShowDays(windowB),
  ['2098-11-05', '2098-11-06', '2098-11-07']
);

// (3) CORE NEGATIVE CONTROL: two different windows must produce two different day lists —
// rules out a hardcoded/memoized list satisfying (1) and (2) independently by coincidence.
{
  const a = JSON.stringify(computeShowDays(windowA));
  const b = JSON.stringify(computeShowDays(windowB));
  if (a === b) {
    failures.push('(3) CORE DEFECT: windowA and windowB produced IDENTICAL day lists — output is not driven by the window argument.');
  }
}

// (4) Single-day window -> exactly one day.
//
// SAST-local boundaries, not raw UTC midnight: an SAOC editor entering "15th, 00:00:00"
// through "15th, 23:59:59.999" in Sanity Studio (SAST, UTC+2) produces stored instants of
// 2099-06-14T22:00:00.000Z (SAST midnight the night before, in UTC) through
// 2099-06-15T21:59:59.999Z. Raw UTC midnight-to-midnight (2099-06-15T00:00:00.000Z to
// 2099-06-15T23:59:59.999Z) is NOT a single SAST day — it spans SAST 02:00 on the 15th
// through SAST 01:59:59 on the 16th, i.e. two SAST calendar days — so it cannot be used here.
check(
  '(4) single-day window',
  computeShowDays({
    startDate: new Date('2099-06-14T22:00:00.000Z'),
    endDate: new Date('2099-06-15T21:59:59.999Z'),
  }),
  ['2099-06-15']
);

// (5) Cross-month-boundary window -> correct calendar rollover, not naive date-digit math.
check(
  '(5) cross-month-boundary window',
  computeShowDays({
    startDate: new Date('2099-01-30T00:00:00.000Z'),
    endDate: new Date('2099-02-02T00:00:00.000Z'),
  }),
  ['2099-01-30', '2099-01-31', '2099-02-01', '2099-02-02']
);

// (6) SAST-ENTRY, UTC-STORED window -> the calendar day an SAOC editor actually intended,
// not the raw UTC calendar day of the stored instant.
//
// Sanity always stores `datetime` fields with an explicit UTC offset ('Z'). An editor working
// in Sanity Studio (SAST, UTC+2) who enters "16th, 00:00" through "16th, 23:59:59.999" for a
// single show day produces stored instants of 2099-09-15T22:00:00.000Z (SAST midnight the
// night before, in UTC) through 2099-09-16T21:59:59.999Z. `computeShowDays()` must report this
// window as the ONE day the editor entered, '2099-09-16' — not the raw UTC calendar days
// (2099-09-15 AND 2099-09-16) of the stored instants, which is what naive
// `getUTCFullYear/Month/Date()` extraction on the raw instant produces. See project memory
// reference_firestore_timestamps_are_utc: this server/its editors are SAST; Firestore/Sanity
// datetimes are UTC; converting wrong here silently shifts (or, as here, spuriously widens)
// which calendar day a visitor can select. This fixture uses the same 2099 synthetic year as
// every other fixture in this check — never a real or placeholder show-date literal.
check(
  '(6) SAST-entered single day, stored as UTC -> exactly the intended day, not a raw-UTC 2-day span',
  computeShowDays({
    startDate: new Date('2099-09-15T22:00:00.000Z'),
    endDate: new Date('2099-09-16T21:59:59.999Z'),
  }),
  ['2099-09-16']
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: computeShowDays() derives its entire output from the ShowWindow argument, correctly, including cross-month rollover.');
