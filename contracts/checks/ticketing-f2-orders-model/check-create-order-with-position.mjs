#!/usr/bin/env node
// Behavioural proof of F2's Done criteria: "orders collection exists, a test order with
// one position can be created, position document has orderId reference ... and a position
// can still be fetched by bookingRef with all fields intact."
//
// REVISED 2026-08-17: F2 is additive-only on `Ticket` (see golden/README.md "Field-move
// decision, revised") — createOrderWithPosition() writes amount/purchasedAt/m_payment_id/
// pf_payment_id onto BOTH the order and the position (duplicated, not moved), because two
// live consumers (app/admin/page.tsx, app/api/admin/tickets/route.ts) still read those
// fields directly off `tickets` documents and would silently show blank/undefined amounts
// for any order created by this function otherwise. The duplication is deliberately
// temporary: F10 removes it from the position once checkout/ITN become order-aware and a
// backfill runs.
//
// Calls the REAL createOrderWithPosition() from lib/orders.ts (not a reimplementation of
// its logic here) against a fixed, clearly-marked, idempotent fixture id pair. Per hard
// constraint #2 (never delete a Firestore document) this check never calls .delete() —
// instead it reuses the SAME fixture ids on every run, and createOrderWithPosition() is
// specified to write with `transaction.set()` (idempotent upsert), so repeated contract
// runs overwrite the one fixture pair rather than accumulating orphan documents. See
// golden/README.md "Fixture lifecycle" for the full reasoning.
//
// Run as: npx tsx contracts/checks/ticketing-f2-orders-model/check-create-order-with-position.mjs
// (npx tsx, not `node --import tsx/esm` — lib/orders.ts and lib/firebase-admin.ts are
// imported through the `@/` alias inside createOrderWithPosition's own module graph in
// some future caller, and this project's established rule (see F1's
// check-checkout-active-show-gate.mjs) is: anything that touches `@/`-aliased imports at
// any import depth uses the `npx tsx` CLI, not `node --import tsx/esm`.)
// Requires FIREBASE_ADMIN_* credentials in .env.local.

import { config } from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '../../../lib/firebase-admin.ts';
import { createOrderWithPosition, ORDERS_COLLECTION } from '../../../lib/orders.ts';

config({ path: '.env.local', quiet: true });

const TICKETS_COLLECTION = 'tickets';

// Fixed, human-obviously-fake ids — reused every run, never generated fresh, never
// deleted. Distinct from any real Crockford-alphabet bookingRef generateBookingRef()
// could ever produce (real refs never contain the literal word "FIXTURE").
const FIXTURE_ORDER_ID = 'contract-f2-fixture-order';
const FIXTURE_BOOKING_REF = 'SAOC-2027-CONTRACT-F2-FIXTURE';
const FIXTURE_SHOW_ID = 'contract-f2-fixture-show';

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

try {
  initAdmin();
  const db = getFirestore();

  const result = await createOrderWithPosition({
    orderId: FIXTURE_ORDER_ID,
    bookingRef: FIXTURE_BOOKING_REF,
    showId: FIXTURE_SHOW_ID,
    buyerName: 'Contract F2 Fixture Buyer',
    buyerEmail: 'contract-f2-fixture@saoc.test',
    attendeeName: 'Contract F2 Fixture Attendee',
    attendeeEmail: 'contract-f2-fixture@saoc.test',
    ticketType: 'contract-f2-fixture-ticket-type',
    amount: 250,
    orderStatus: 'paid',
    positionStatus: 'paid',
    idempotencyKey: 'contract-f2-fixture-idempotency-key',
    expiresAt: null,
    purchasedAt: null,
    gateway: 'payfast',
    gatewayPaymentId: FIXTURE_BOOKING_REF,
    m_payment_id: FIXTURE_BOOKING_REF,
    pf_payment_id: FIXTURE_BOOKING_REF,
  });

  expect(result.orderId === FIXTURE_ORDER_ID, `expected orderId '${FIXTURE_ORDER_ID}', got '${result.orderId}'`);
  expect(
    result.ticketId === FIXTURE_BOOKING_REF,
    `expected ticketId '${FIXTURE_BOOKING_REF}', got '${result.ticketId}'`
  );

  const orderSnap = await db.collection(ORDERS_COLLECTION).doc(FIXTURE_ORDER_ID).get();
  expect(orderSnap.exists, `orders/${FIXTURE_ORDER_ID} does not exist after createOrderWithPosition()`);
  if (orderSnap.exists) {
    const order = orderSnap.data();
    expect(order.showId === FIXTURE_SHOW_ID, `order.showId: expected '${FIXTURE_SHOW_ID}', got '${order.showId}'`);
    expect(order.buyerEmail === 'contract-f2-fixture@saoc.test', `order.buyerEmail mismatch: '${order.buyerEmail}'`);
    expect(order.amount === 250, `order.amount: expected 250, got ${order.amount}`);
    expect(order.status === 'paid', `order.status: expected 'paid', got '${order.status}'`);
    expect(order.gateway === 'payfast', `order.gateway: expected 'payfast', got '${order.gateway}'`);
    expect(
      order.idempotencyKey === 'contract-f2-fixture-idempotency-key',
      `order.idempotencyKey mismatch: '${order.idempotencyKey}'`
    );
  }

  const positionSnap = await db.collection(TICKETS_COLLECTION).doc(FIXTURE_BOOKING_REF).get();
  expect(
    positionSnap.exists,
    `tickets/${FIXTURE_BOOKING_REF} does not exist after createOrderWithPosition()`
  );
  if (positionSnap.exists) {
    const position = positionSnap.data();
    expect(
      position.orderId === FIXTURE_ORDER_ID,
      `position.orderId: expected '${FIXTURE_ORDER_ID}', got '${position.orderId}'`
    );
    expect(
      position.bookingRef === FIXTURE_BOOKING_REF,
      `position.bookingRef: expected '${FIXTURE_BOOKING_REF}', got '${position.bookingRef}'`
    );
    expect(position.showId === FIXTURE_SHOW_ID, `position.showId: expected '${FIXTURE_SHOW_ID}', got '${position.showId}'`);
    expect(
      position.attendeeName === 'Contract F2 Fixture Attendee',
      `position.attendeeName mismatch: '${position.attendeeName}'`
    );
    expect(
      position.ticketType === 'contract-f2-fixture-ticket-type',
      `position.ticketType mismatch: '${position.ticketType}'`
    );
    expect(position.status === 'paid', `position.status: expected 'paid', got '${position.status}'`);
    // Additive-only (revised): amount/m_payment_id/pf_payment_id are duplicated onto the
    // position too, matching every other Ticket-typed consumer's expectations (see header
    // comment) — this function does NOT remove them, only adds orderId.
    expect(position.amount === 250, `position.amount: expected 250, got ${position.amount}`);
    expect(
      position.pf_payment_id === FIXTURE_BOOKING_REF,
      `position.pf_payment_id: expected '${FIXTURE_BOOKING_REF}', got '${position.pf_payment_id}'`
    );
    expect(
      position.m_payment_id === FIXTURE_BOOKING_REF,
      `position.m_payment_id: expected '${FIXTURE_BOOKING_REF}', got '${position.m_payment_id}'`
    );
    // gateway/gatewayPaymentId are genuinely NEW, order-only concepts (§4.4) — no legacy
    // Ticket-typed consumer ever read them, so they must NOT be duplicated onto the
    // position; only the order carries them.
    expect(position.gateway === undefined, `position.gateway should not exist, found '${position.gateway}'`);
    expect(
      position.gatewayPaymentId === undefined,
      `position.gatewayPaymentId should not exist, found '${position.gatewayPaymentId}'`
    );
  }

  // Fetch by bookingRef the way lib/checkin.ts does — a query, not a direct doc().get() —
  // proving the door-scan read shape still finds this position with all fields intact.
  const byBookingRef = await db
    .collection(TICKETS_COLLECTION)
    .where('bookingRef', '==', FIXTURE_BOOKING_REF)
    .limit(1)
    .get();
  expect(!byBookingRef.empty, `tickets query by bookingRef == '${FIXTURE_BOOKING_REF}' returned no results`);
  if (!byBookingRef.empty) {
    const data = byBookingRef.docs[0].data();
    const requiredFields = [
      'bookingRef',
      'showId',
      'attendeeName',
      'attendeeEmail',
      'ticketType',
      'status',
      'amount',
      'purchasedAt',
      'checkedInAt',
      'm_payment_id',
      'pf_payment_id',
      'orderId',
    ];
    for (const field of requiredFields) {
      expect(field in data, `position fetched by bookingRef is missing field '${field}'`);
    }
  }
} catch (err) {
  console.error(`FAIL: threw — ${err.stack ?? err.message}`);
  process.exit(1);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: createOrderWithPosition() writes a linked orders/{id} + tickets/{bookingRef} pair; ' +
    'the position carries orderId ADDITIONALLY to every pre-existing field (amount/' +
    'purchasedAt/m_payment_id/pf_payment_id all still present), and is still fetchable by ' +
    'bookingRef with all fields intact.'
);
process.exit(0);
