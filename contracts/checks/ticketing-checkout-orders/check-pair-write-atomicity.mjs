#!/usr/bin/env node
// ticketing-checkout-orders (architect contract) — order/position pair-write atomicity for a
// FRESH checkout reservation. Proven against a FAKE, in-memory Firestore-shaped store — never
// live Firestore — by calling the REAL, exported writeReservationPair() and buildReservationDocs()
// (lib/checkout-reservation.ts) directly. Same technique as
// contracts/checks/ticketing-f8-comp-tickets/check-pair-write-atomicity.mjs, adapted for
// `transaction.create()` semantics (checkout keeps create-and-fail-on-collision, unlike F8/F2's
// idempotent `set()` — see the golden README "Why writeReservationPair uses create(), not set()").
//
// DEFEATING MUTATION this check kills: a checkout implementation that writes the order via
// `db.collection('orders').doc(id).create(order)` OUTSIDE the reservation transaction (e.g. before
// or after `db.runTransaction(...)`, as two independent calls) instead of both writes happening
// through the transaction argument passed into writeReservationPair(). That mutation would still
// pass a naive "does the order exist afterwards" check; it fails THIS check because case (2) forces
// the position write to throw and asserts the order was NEVER committed to the fake store either —
// only possible if both writes genuinely went through the same staged-commit transaction.
//
// The fake models Firestore's own documented transaction contract: every write inside a
// runTransaction() callback is staged, not committed, until the callback resolves; if the callback
// (or a write inside it) throws, everything staged is discarded, not partially applied.
//
// Uses `npx tsx`, not `node --import tsx/esm` — lib/checkout-reservation.ts imports
// `firebase-admin/firestore` (a real, non-type-only import, for the `Timestamp` class), and this
// script's own import of `../../../lib/checkout-reservation.ts` needs tsx's `@/*`-aware resolver
// if that module ever gains an `@/*` import in the future. Matching the project convention
// (contracts/golden/ticketing-f10-itn-repin/README.md "npx tsx vs node --import tsx/esm"): when in
// doubt, use npx tsx.
//
// This script writes nothing to Firestore, live or otherwise, and creates no fixture data.
//
// Run as: npx tsx contracts/checks/ticketing-checkout-orders/check-pair-write-atomicity.mjs

import { Timestamp } from 'firebase-admin/firestore';

import { buildReservationDocs, writeReservationPair } from '../../../lib/checkout-reservation.ts';

const failures = [];

class FakeFirestore {
  constructor({ failOnCollection } = {}) {
    this.failOnCollection = failOnCollection ?? null;
    this.committed = { orders: new Map(), tickets: new Map() };
    this._autoIdCounter = 0;
  }

  collection(name) {
    return {
      doc: (id) => {
        const docId = id ?? `fake-auto-id-${++this._autoIdCounter}`;
        return { id: docId, __collection: name };
      },
    };
  }

  // Models db.runTransaction(): every write staged inside `fn` commits together, only once `fn`
  // resolves without throwing. This is the property that makes "both documents or neither"
  // provable without a live database.
  async runTransaction(fn) {
    const staged = [];
    const transaction = {
      create: (ref, data) => {
        if (this.failOnCollection === ref.__collection) {
          throw new Error(`simulated Firestore write failure on collection '${ref.__collection}'`);
        }
        staged.push({ ref, data });
      },
    };

    const result = await fn(transaction);
    for (const { ref, data } of staged) {
      this.committed[ref.__collection].set(ref.id, data);
    }
    return result;
  }
}

const NOW = Timestamp.fromMillis(1_700_000_000_000);
const EXPIRES_AT = Timestamp.fromMillis(1_700_000_000_000 + 30 * 60_000);

function buildDocsFor(orderId, bookingRef) {
  return buildReservationDocs({
    orderId,
    bookingRef,
    showId: 'nationalShow',
    attendeeName: 'Test Attendee',
    attendeeEmail: 'attendee@example.com',
    ticketType: 'general-admission',
    amount: 250,
    idempotencyKey: 'idem-key-atomicity-test',
    expiresAt: EXPIRES_AT,
    recoveryToken: 'fake.recovery.token',
    recoveryTokenExpiresAt: Timestamp.fromMillis(1_700_000_000_000 + 180 * 24 * 60 * 60_000),
    now: NOW,
  });
}

// (1) Success path: both documents land in the fake store, correctly linked and shaped, mirroring
// exactly what checkout's 'created' branch must produce for markOrderAndPositionPaidByPaymentId
// (lib/orders.ts, F10) to later find and flip them.
{
  const store = new FakeFirestore();
  const orderRef = store.collection('orders').doc();
  const positionRef = store.collection('tickets').doc('SAOC-2027-ATOMTEST01');
  const docs = buildDocsFor(orderRef.id, 'SAOC-2027-ATOMTEST01');

  await store.runTransaction((transaction) => {
    writeReservationPair(transaction, { orderRef, positionRef }, docs);
  });

  const order = store.committed.orders.get(orderRef.id);
  const position = store.committed.tickets.get(positionRef.id);

  if (!order) failures.push('(1) No order document was committed to the fake store on the success path.');
  if (!position) failures.push('(1) No position document was committed to the fake store on the success path.');
  if (order && position) {
    if (position.orderId !== orderRef.id) {
      failures.push(`(1) position.orderId ('${position.orderId}') does not equal the order ref's id ('${orderRef.id}').`);
    }
    if (order.status !== 'reserved') failures.push(`(1) order.status was '${order.status}', expected 'reserved'.`);
    if (position.status !== 'reserved') failures.push(`(1) position.status was '${position.status}', expected 'reserved'.`);
    if (order.gateway !== 'payfast') failures.push(`(1) order.gateway was '${order.gateway}', expected 'payfast'.`);
    if (order.m_payment_id !== 'SAOC-2027-ATOMTEST01') {
      failures.push(`(1) order.m_payment_id was '${order.m_payment_id}', expected the bookingRef.`);
    }
    if (position.m_payment_id !== 'SAOC-2027-ATOMTEST01') {
      failures.push(`(1) position.m_payment_id was '${position.m_payment_id}', expected the bookingRef.`);
    }
    if (position.idempotencyKey !== 'idem-key-atomicity-test') {
      failures.push('(1) position.idempotencyKey was not carried onto the position (backward-compat duplicate-probe field).');
    }
    if (order.idempotencyKey !== 'idem-key-atomicity-test') {
      failures.push('(1) order.idempotencyKey was not set on the order (F2 canonical location).');
    }
    if (order.recoveryToken !== 'fake.recovery.token') {
      failures.push('(1) order.recoveryToken was not set — the order-creation-time minting did not reach the written document.');
    }
    if ('recoveryToken' in position) {
      failures.push('(1) recoveryToken leaked onto the position document — it must live on the order ONLY.');
    }
    if ('gateway' in position || 'gatewayPaymentId' in position) {
      failures.push('(1) gateway/gatewayPaymentId leaked onto the position — F2 defines these as order-only concepts.');
    }
  }
}

// (2) Atomicity: the POSITION write is forced to fail. If writeReservationPair() genuinely routes
// both writes through the SAME already-open transaction, the caller's runTransaction() rejects and
// NEITHER document is committed — not even the order, whose write is issued first.
{
  const store = new FakeFirestore({ failOnCollection: 'tickets' });
  const orderRef = store.collection('orders').doc();
  const positionRef = store.collection('tickets').doc('SAOC-2027-ATOMTEST02');
  const docs = buildDocsFor(orderRef.id, 'SAOC-2027-ATOMTEST02');

  let threw = false;
  try {
    await store.runTransaction((transaction) => {
      writeReservationPair(transaction, { orderRef, positionRef }, docs);
    });
  } catch {
    threw = true;
  }

  if (!threw) {
    failures.push('(2) The transaction did not reject when the position write was forced to fail — expected it to abort.');
  }
  if (store.committed.orders.size !== 0) {
    failures.push(
      `(2) ${store.committed.orders.size} order document(s) were committed even though the position write in the SAME transaction failed.`
    );
  }
  if (store.committed.tickets.size !== 0) {
    failures.push(`(2) ${store.committed.tickets.size} position document(s) were committed even though the write failed — expected zero.`);
  }
}

// (3) Negative control on (2): forcing the ORDER write to fail instead must ALSO leave both
// collections empty — proving the rollback isn't an artefact of write ordering (writeReservationPair
// issues the order create FIRST; this proves failure of the FIRST write is caught too).
{
  const store = new FakeFirestore({ failOnCollection: 'orders' });
  const orderRef = store.collection('orders').doc();
  const positionRef = store.collection('tickets').doc('SAOC-2027-ATOMTEST03');
  const docs = buildDocsFor(orderRef.id, 'SAOC-2027-ATOMTEST03');

  let threw = false;
  try {
    await store.runTransaction((transaction) => {
      writeReservationPair(transaction, { orderRef, positionRef }, docs);
    });
  } catch {
    threw = true;
  }

  if (!threw) {
    failures.push('(3) The transaction did not reject when the order write was forced to fail — expected it to abort.');
  }
  if (store.committed.orders.size !== 0 || store.committed.tickets.size !== 0) {
    failures.push('(3) A document was committed even though the order write failed — expected zero in both collections.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: writeReservationPair(), given an already-open transaction, writes a fresh order and its ' +
    "position as a single atomic pair — correctly linked and shaped on the success path (including " +
    'the recoveryToken landing on the order only, never the position), with NEITHER document ' +
    "committed when either half of the pair's write fails — proven against a fake store that models " +
    "Firestore's real transaction commit/rollback contract, never against live Firestore."
);
process.exit(0);
