#!/usr/bin/env node
// Behavioural proof that the fifth TicketStatus value, 'refunded', round-trips through a
// real Firestore write/read AND that lib/checkin.ts's UNMODIFIED door-admission logic
// already refuses a refunded position safely — a regression guard proving F2 needs no
// change to checkInByBookingRef()'s decision table to stay fail-closed against the new
// status value. admit() only ever admits `status === 'paid'`; every other status
// (including all four pre-F2 values) falls through to refuse('unpaid'). 'refunded' is
// simply a fifth value that was never 'paid' at read time, so it takes the same branch —
// proved here by an actual call, not by reading the source.
//
// Uses NATIONAL_SHOW_ID as the fixture's showId (required — checkInByBookingRef() refuses
// any other showId with 'wrong-show' before status is ever inspected, which would prove
// nothing about the status branch). This is safe: the transaction only ever reads/writes
// the ONE document matching this exact, fixed, clearly-marked fixture bookingRef — no real
// buyer's document, and no capacity counter, is touched. A refusal writes nothing at all.
//
// Same fixture-lifecycle rule as check-create-order-with-position.mjs: fixed ids, never
// deleted, createOrderWithPosition() upserts idempotently on every run.
//
// Run as: npx tsx contracts/checks/ticketing-f2-orders-model/check-refunded-status-and-checkin-refusal.mjs
// Requires FIREBASE_ADMIN_* credentials in .env.local.

import { config } from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';

import { checkInByBookingRef } from '../../../lib/checkin.ts';
import { initAdmin } from '../../../lib/firebase-admin.ts';
import { createOrderWithPosition } from '../../../lib/orders.ts';
import { NATIONAL_SHOW_ID } from '../../../lib/tickets-constants.ts';

config({ path: '.env.local', quiet: true });

const TICKETS_COLLECTION = 'tickets';

const FIXTURE_ORDER_ID = 'contract-f2-fixture-order-refunded';
const FIXTURE_BOOKING_REF = 'SAOC-2027-CONTRACT-F2-FIXTURE-REFUNDED';

// Self-verifying safety net (requested by @architect review, 2026-08-17): this is the one
// F2 check that deliberately shares a REAL production showId (NATIONAL_SHOW_ID) with live
// data, and it calls the real, mutating checkInByBookingRef(). A future edit that changes
// FIXTURE_BOOKING_REF away from an unmistakably-synthetic value, or that starts reusing
// this constant for something else, must not be able to accidentally point this call at a
// real booking reference. Refuse to run at all if the marker is missing.
const FIXTURE_MARKER = 'CONTRACT-F2-FIXTURE';
if (!FIXTURE_BOOKING_REF.includes(FIXTURE_MARKER)) {
  console.error(
    `FAIL: FIXTURE_BOOKING_REF ('${FIXTURE_BOOKING_REF}') does not contain the required ` +
      `'${FIXTURE_MARKER}' marker — refusing to call checkInByBookingRef() against a ref ` +
      'that cannot be proven synthetic. This guard exists because this check shares ' +
      'NATIONAL_SHOW_ID with real bookings and must never risk touching one.'
  );
  process.exit(1);
}

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

try {
  initAdmin();
  const db = getFirestore();

  // The order itself stays 'paid' — a refund targets the POSITION (§4.3's whole point:
  // "you cancel one position, not a whole order"). Only positionStatus is 'refunded'.
  // Re-run on every contract pass: idempotent upsert re-establishes 'refunded' even if a
  // prior run of some OTHER check ever left this exact fixture doc in a different state
  // (it never should, since no other check shares this bookingRef, but this keeps the
  // check self-contained regardless).
  await createOrderWithPosition({
    orderId: FIXTURE_ORDER_ID,
    bookingRef: FIXTURE_BOOKING_REF,
    showId: NATIONAL_SHOW_ID,
    buyerName: 'Contract F2 Fixture Buyer',
    buyerEmail: 'contract-f2-fixture@saoc.test',
    attendeeName: 'Contract F2 Fixture Refunded Attendee',
    attendeeEmail: 'contract-f2-fixture@saoc.test',
    ticketType: 'contract-f2-fixture-ticket-type',
    amount: 250,
    orderStatus: 'paid',
    positionStatus: 'refunded',
    idempotencyKey: 'contract-f2-fixture-idempotency-key-refunded',
    expiresAt: null,
    purchasedAt: null,
    gateway: 'payfast',
    gatewayPaymentId: FIXTURE_BOOKING_REF,
    m_payment_id: FIXTURE_BOOKING_REF,
    pf_payment_id: FIXTURE_BOOKING_REF,
  });

  const beforeSnap = await db.collection(TICKETS_COLLECTION).doc(FIXTURE_BOOKING_REF).get();
  expect(beforeSnap.exists, `tickets/${FIXTURE_BOOKING_REF} does not exist`);
  if (beforeSnap.exists) {
    expect(
      beforeSnap.data().status === 'refunded',
      `position.status before check-in attempt: expected 'refunded', got '${beforeSnap.data().status}'`
    );
  }

  const result = await checkInByBookingRef(FIXTURE_BOOKING_REF);
  expect(result.ok === false, `checkInByBookingRef() on a refunded position: expected ok:false, got ok:${result.ok}`);
  if (result.ok === false) {
    expect(
      result.code === 'unpaid',
      `checkInByBookingRef() refusal code: expected 'unpaid' (refunded is not 'paid'), got '${result.code}'`
    );
    expect(result.httpStatus === 403, `refusal httpStatus: expected 403, got ${result.httpStatus}`);
  }

  // Idempotent-refusal proof: the position must be untouched by the refused attempt —
  // still 'refunded', not silently flipped to 'checked-in'.
  const afterSnap = await db.collection(TICKETS_COLLECTION).doc(FIXTURE_BOOKING_REF).get();
  expect(
    afterSnap.exists && afterSnap.data().status === 'refunded',
    `position.status after refused check-in attempt: expected to remain 'refunded', got ` +
      `'${afterSnap.exists ? afterSnap.data().status : '<missing>'}'`
  );
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
  "PASS: a position written with status 'refunded' round-trips through Firestore, and a " +
    "live checkInByBookingRef() call against it is refused (code 'unpaid', 403) and leaves " +
    "the position's status untouched — lib/checkin.ts needs no change to stay fail-closed."
);
process.exit(0);
