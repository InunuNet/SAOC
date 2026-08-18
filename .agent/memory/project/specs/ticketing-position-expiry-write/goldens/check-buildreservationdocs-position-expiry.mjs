#!/usr/bin/env node
// ticketing-position-expiry-write F1, A2 — proves buildReservationDocs (the LIVE checkout
// path's position-writing primitive, lib/checkout-reservation.ts) sets expiresAt on the
// POSITION, not just the order. Pure function, real import, no live Firestore.
//
// Run as: npx tsx .agent/memory/project/specs/ticketing-position-expiry-write/goldens/check-buildreservationdocs-position-expiry.mjs

import { buildReservationDocs } from '../../../../../../lib/checkout-reservation.ts';
import { Timestamp } from 'firebase-admin/firestore';

const failures = [];
function assert(condition, message) {
  if (!condition) failures.push(message);
}

const now = Timestamp.fromMillis(Date.parse('2026-08-18T12:00:00Z'));
const expiresAt = Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000);

const { order, position } = buildReservationDocs({
  orderId: 'order-1',
  bookingRef: 'BOOKREF01',
  showId: 'nationalShow',
  attendeeName: 'Test Buyer',
  attendeeEmail: 'buyer@example.invalid',
  ticketType: 'exhibitor',
  amount: 0,
  idempotencyKey: 'idem-1',
  expiresAt,
  recoveryToken: 'token-1',
  recoveryTokenExpiresAt: Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000),
  now,
});

assert(order.expiresAt === expiresAt, 'order.expiresAt should equal the input expiresAt (existing behaviour)');
assert(
  position.expiresAt !== undefined,
  'position.expiresAt is undefined — the position never got the field at all (the original defect)'
);
assert(
  position.expiresAt === expiresAt,
  `position.expiresAt must be the EXACT SAME Timestamp instance as input.expiresAt, not a freshly minted one — got ${JSON.stringify(position.expiresAt)}`
);

if (failures.length > 0) {
  console.error('FAIL — buildReservationDocs position expiresAt proof violated:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('PASS — buildReservationDocs writes expiresAt onto the position, matching the order exactly.');
