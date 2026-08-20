// A6 — order/N-position pair-write atomicity for a FRESH multi-line-item reservation.
// Extends contracts/checks/ticketing-checkout-orders/check-pair-write-atomicity.mjs's
// technique (fake, in-memory Firestore-shaped store; real exported functions) from N=1
// to N=3 across mixed ticket types, and proves the all-or-nothing property specifically
// for a MIDDLE write failing — not just a last-write failure, which a sloppy
// implementation (e.g. one that commits writes as it goes instead of staging them) could
// pass by accident if only the LAST item were ever tested.
//
// Also proves the reference/m_payment_id design decided in this contract's README: the
// order-level payment reference is the FIRST line item's own bookingRef (preserving the
// existing single-item convention exactly, where the one position's bookingRef, the
// order's m_payment_id, and the client-facing reference were always the same value) —
// not a newly invented, separate identifier. Every position in the order shares that
// same m_payment_id value, while each keeps its OWN document id (its own door code).
//
// This check imports functions that do not exist on the current tree — expected to fail
// with a module-resolution error until @dev adds buildMultiReservationDocs() and
// writeMultiReservationPair() to lib/checkout-reservation.ts per F1.
//
// Run as: npx tsx contracts/checks/ticketing-multi-line-item-cart/check-multi-write-atomicity.mjs

import { Timestamp } from 'firebase-admin/firestore';

import { buildMultiReservationDocs, writeMultiReservationPair } from '../../../lib/checkout-reservation.ts';

const failures = [];

class FakeFirestore {
  constructor({ failOnDocId } = {}) {
    this.failOnDocId = failOnDocId ?? null;
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

  async runTransaction(fn) {
    const staged = [];
    const transaction = {
      create: (ref, data) => {
        if (this.failOnDocId === ref.id) {
          throw new Error(`simulated Firestore write failure on doc '${ref.id}'`);
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

const LINE_ITEMS = [
  { ticketType: 'early-bird', attendeeName: 'Attendee One', attendeeEmail: 'one@example.com', amount: 130, bookingRef: 'SAOC-2027-MULTIPOS01' },
  { ticketType: 'day-visitor', attendeeName: 'Attendee Two', attendeeEmail: 'two@example.com', amount: 150, bookingRef: 'SAOC-2027-MULTIPOS02' },
  { ticketType: 'vip', attendeeName: 'Attendee Three', attendeeEmail: 'three@example.com', amount: 300, bookingRef: 'SAOC-2027-MULTIPOS03' },
];
const REFERENCE = LINE_ITEMS[0].bookingRef; // decision: order-level reference == first line item's own bookingRef

function buildInput(orderId) {
  return {
    orderId,
    reference: REFERENCE,
    showId: 'nationalShow',
    lineItems: LINE_ITEMS,
    idempotencyKey: 'idem-multi-write-test',
    expiresAt: EXPIRES_AT,
    recoveryToken: 'fake.recovery.token',
    recoveryTokenExpiresAt: Timestamp.fromMillis(1_700_000_000_000 + 180 * 24 * 60 * 60_000),
    now: NOW,
  };
}

// (1) Success path: 1 order + 3 positions all committed, correctly linked and shaped.
{
  const store = new FakeFirestore();
  const orderRef = store.collection('orders').doc();
  const positionRefs = LINE_ITEMS.map((item) => store.collection('tickets').doc(item.bookingRef));
  const docs = buildMultiReservationDocs(buildInput(orderRef.id));

  await store.runTransaction((transaction) => {
    writeMultiReservationPair(transaction, { orderRef, positionRefs }, docs);
  });

  const order = store.committed.orders.get(orderRef.id);
  if (!order) {
    failures.push('(1) no order document was committed on the success path.');
  } else {
    if (order.amount !== 130 + 150 + 300) {
      failures.push(`(1) order.amount was ${order.amount}, expected the sum of all three line items (580).`);
    }
    if (order.m_payment_id !== REFERENCE) {
      failures.push(`(1) order.m_payment_id was '${order.m_payment_id}', expected the reference ('${REFERENCE}').`);
    }
  }

  for (const item of LINE_ITEMS) {
    const position = store.committed.tickets.get(item.bookingRef);
    if (!position) {
      failures.push(`(1) position '${item.bookingRef}' was not committed on the success path.`);
      continue;
    }
    if (position.orderId !== orderRef.id) {
      failures.push(`(1) position '${item.bookingRef}'.orderId does not equal the order ref's id.`);
    }
    if (position.m_payment_id !== REFERENCE) {
      failures.push(`(1) position '${item.bookingRef}'.m_payment_id ('${position.m_payment_id}') must equal the shared order reference ('${REFERENCE}'), not its own bookingRef alone.`);
    }
    if (position.ticketType !== item.ticketType) {
      failures.push(`(1) position '${item.bookingRef}'.ticketType was '${position.ticketType}', expected '${item.ticketType}'.`);
    }
    if (position.amount !== item.amount) {
      failures.push(`(1) position '${item.bookingRef}'.amount was ${position.amount}, expected its own line item's price (${item.amount}), not the order total.`);
    }
    if ('recoveryToken' in position) {
      failures.push(`(1) recoveryToken leaked onto position '${item.bookingRef}' — order-only, same posture as the single-item case.`);
    }
  }

  if (store.committed.tickets.size !== LINE_ITEMS.length) {
    failures.push(`(1) expected exactly ${LINE_ITEMS.length} position documents committed, got ${store.committed.tickets.size}.`);
  }
}

// (2) THE ALL-OR-NOTHING PROOF: the MIDDLE position's write is forced to fail. If the
// writer stages every write and only commits once every write in the callback has
// succeeded, NEITHER the order NOR position 1 NOR position 3 may be committed — only a
// staged-commit implementation can produce this; an implementation that writes as it
// goes (write order -> write pos1 -> write pos2 [throws] -> never reaches pos3) would
// still show the order and position 1 present in a naive fake, which is exactly why the
// fake below re-throws from inside runTransaction() and this check asserts ALL THREE
// collections stay empty, not just that pos2 is missing.
{
  const store = new FakeFirestore({ failOnDocId: LINE_ITEMS[1].bookingRef });
  const orderRef = store.collection('orders').doc();
  const positionRefs = LINE_ITEMS.map((item) => store.collection('tickets').doc(item.bookingRef));
  const docs = buildMultiReservationDocs(buildInput(orderRef.id));

  let threw = false;
  try {
    await store.runTransaction((transaction) => {
      writeMultiReservationPair(transaction, { orderRef, positionRefs }, docs);
    });
  } catch {
    threw = true;
  }

  if (!threw) {
    failures.push('(2) forcing the middle position write to fail should have rejected the transaction — it did not throw.');
  }
  if (store.committed.orders.size !== 0) {
    failures.push('(2) the order was committed even though a position write in the SAME transaction failed — not atomic.');
  }
  if (store.committed.tickets.size !== 0) {
    failures.push(`(2) ${store.committed.tickets.size} position(s) were committed even though the middle write failed — not atomic. All-or-nothing means position 1 and position 3 must be discarded too.`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: buildMultiReservationDocs()/writeMultiReservationPair() write N positions + 1 order atomically, all-or-nothing.');
