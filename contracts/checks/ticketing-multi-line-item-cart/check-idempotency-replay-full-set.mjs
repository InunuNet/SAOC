// A4 — lineItemsMatchExistingPositions() (lib/checkout-reservation.ts, F1) must compare
// the FULL multiset of {ticketType, attendeeEmail} pairs between a replayed request and
// the positions an idempotency key already produced — order-independent, and sensitive
// to COUNT, not just to which distinct pairs appear.
//
// THE DEFECT CLASS THIS TARGETS
// Today's single-item duplicate probe is `tickets.where('idempotencyKey', '==',
// key).limit(1)` and compares only that ONE document's ticketType/attendeeEmail against
// the request. The literal, laziest port to N line items keeps the `.limit(1)` and
// compares only the request's FIRST line item against it — silently ignoring every other
// line item. A replaying client whose first item matches but whose second item has been
// swapped to a different (possibly higher-priced) ticket type, or a different attendee
// email, would be waved through as a valid replay and handed a live payment hand-off for
// a purchase it never actually reserved. This check proves the comparison is genuinely
// over the WHOLE set, in both directions (missing count, differing content), not just
// element zero.
//
// This check imports a function that does not exist on the current tree — expected to
// fail with a module-resolution error until @dev adds it per F1.
//
// Run as: npx tsx contracts/checks/ticketing-multi-line-item-cart/check-idempotency-replay-full-set.mjs

import { lineItemsMatchExistingPositions } from '../../../lib/checkout-reservation.ts';

const failures = [];

const A = { ticketType: 'early-bird', attendeeEmail: 'a@example.com' };
const B = { ticketType: 'day-visitor', attendeeEmail: 'b@example.com' };
const C = { ticketType: 'vip', attendeeEmail: 'c@example.com' };

function expect(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${expected}, got ${actual}`);
  }
}

// (1) Identical sets, same order: must match.
expect('(1) identical, same order', lineItemsMatchExistingPositions([A, B, C], [A, B, C]), true);

// (2) Identical sets, DIFFERENT order (a client is free to resend its array reordered):
// must still match. Order-dependence here would falsely reject a legitimate retry.
expect('(2) identical, reordered', lineItemsMatchExistingPositions([C, A, B], [A, B, C]), true);

// (3) THE CORE DEFECT: first item matches, a LATER item's attendeeEmail has changed. A
// first-item-only comparison (the literal port of today's `.limit(1)` logic) would say
// this matches; it must not.
{
  const tampered = { ...B, attendeeEmail: 'hijacked@example.com' };
  expect(
    '(3) CORE DEFECT: first item matches, second item attendeeEmail tampered',
    lineItemsMatchExistingPositions([A, tampered, C], [A, B, C]),
    false
  );
}

// (4) First item matches, a LATER item's ticketType has changed (e.g. downgraded from a
// higher-priced type after the fact) — must not match.
{
  const tampered = { ...C, ticketType: 'early-bird' };
  expect(
    '(4) first item matches, third item ticketType tampered',
    lineItemsMatchExistingPositions([A, B, tampered], [A, B, C]),
    false
  );
}

// (5) Same DISTINCT pairs, but different COUNT of a repeated pair — the request re-sends
// 2 copies of A where the original reservation only ever created 1. Must not match: this
// is an attempt to grow the order via replay, not merely retry it.
expect('(5) repeated-pair count mismatch', lineItemsMatchExistingPositions([A, A, B], [A, B]), false);

// (6) Fewer items than were originally reserved: must not match.
expect('(6) request has fewer items than existing', lineItemsMatchExistingPositions([A], [A, B]), false);

// (7) More items than were originally reserved: must not match.
expect('(7) request has more items than existing', lineItemsMatchExistingPositions([A, B, C], [A, B]), false);

// Negative control: the harness itself must be able to detect a mismatch at all — prove
// with a case that is obviously different (disjoint sets) rather than trusting the
// subtler cases above alone.
expect('(negative control) disjoint sets', lineItemsMatchExistingPositions([A], [B]), false);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: lineItemsMatchExistingPositions() compares the full multiset, order-independent.');
