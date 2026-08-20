// A8 — buildMultiReservationDocs() (lib/checkout-reservation.ts, F2 of this contract) must
// write each line item's OWN chosenDay onto its OWN position — never cross-applied to every
// position in a mixed cart, and never `undefined` (Firestore rejects undefined field values;
// every other optional position field this file already writes uses explicit null).
//
// THE DEFECT CLASS THIS TARGETS
// A naive "just add the field to the input type" change can compile and pass a single-item
// smoke test while actually copying the FIRST line item's chosenDay onto every position (the
// same class of bug the file's own docstring already flags for buyerName/buyerEmail — "Buyer
// identity for a multi-item order" — applied here to a per-position field that must NOT be
// order-wide). This check builds a MIXED cart (one Day Visitor line item with a chosenDay, one
// Weekend Pass line item without) specifically to catch that.
//
// This check imports a function whose current signature does not accept chosenDay — expected to
// fail (either a thrown/undefined mismatch, or the mixed-cart assertion below) until @dev adds
// lib/checkout-reservation.ts's chosenDay wiring per this contract's brief.
//
// Run as: npx tsx contracts/checks/ticketing-f5-day-attendees/check-position-day-fields.mjs

import { Timestamp } from 'firebase-admin/firestore';

import { buildMultiReservationDocs } from '../../../lib/checkout-reservation.ts';

const failures = [];

function check(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const now = Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z'));
const expiresAt = Timestamp.fromDate(new Date('2099-01-01T01:00:00.000Z'));

const docs = buildMultiReservationDocs({
  orderId: 'order-1',
  reference: 'REF-001',
  showId: 'nationalShow',
  lineItems: [
    {
      ticketType: 'day-visitor',
      attendeeName: 'Alex Chen',
      attendeeEmail: 'alex@example.com',
      amount: 150,
      bookingRef: 'REF-001',
      chosenDay: '2099-01-02',
    },
    {
      ticketType: 'weekend-pass',
      attendeeName: 'Jordan Lee',
      attendeeEmail: 'jordan@example.com',
      amount: 400,
      bookingRef: 'REF-002',
      chosenDay: null,
    },
  ],
  idempotencyKey: '11111111-1111-1111-1111-111111111111',
  expiresAt,
  recoveryToken: 'token',
  recoveryTokenExpiresAt: expiresAt,
  now,
});

const [dayVisitorPosition, weekendPassPosition] = docs.positions;

// (1) The Day Visitor position carries its OWN chosenDay.
check('(1) day-visitor position carries its own chosenDay', dayVisitorPosition?.chosenDay, '2099-01-02');

// (2) CORE DEFECT: the Weekend Pass position must NOT inherit the Day Visitor's chosenDay —
// rules out an implementation that reads lineItems[0].chosenDay for every position.
check(
  "(2) CORE DEFECT: weekend-pass position does not inherit day-visitor's chosenDay",
  weekendPassPosition?.chosenDay,
  null
);

// (3) Explicit null, not undefined, for a line item with none — 'chosenDay' key must exist.
if (!weekendPassPosition || !('chosenDay' in weekendPassPosition)) {
  failures.push('(3) weekend-pass position is missing the chosenDay key entirely (must be explicit null, not omitted).');
} else if (weekendPassPosition.chosenDay === undefined) {
  failures.push('(3) CORE DEFECT: weekend-pass position.chosenDay is undefined — Firestore rejects undefined field values; must be explicit null.');
}

// (4) Exactly one of the two positions in this mixed cart carries a non-null chosenDay.
{
  const nonNullCount = docs.positions.filter((p) => p.chosenDay !== null && p.chosenDay !== undefined).length;
  check('(4) exactly one position in the mixed cart has a non-null chosenDay', nonNullCount, 1);
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: buildMultiReservationDocs() writes each chosenDay onto its own position only, as explicit null when absent.');
