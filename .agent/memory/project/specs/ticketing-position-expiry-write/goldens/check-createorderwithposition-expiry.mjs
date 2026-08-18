#!/usr/bin/env node
// ticketing-position-expiry-write F1, A3 — proves createOrderWithPosition (lib/orders.ts, the
// shared primitive F8/comp-tickets and future features build on) ALSO sets expiresAt on the
// position, not just the order — the same defect class as buildReservationDocs (A2), fixed
// independently here because the two files are near-duplicates of each other and it is exactly
// how the bug happened twice.
//
// Fake in-memory Firestore-shaped store (deps.db injected) — no live Firestore. Same technique
// as this codebase's own F8 pair-write-atomicity proof.
//
// Run as: npx tsx .agent/memory/project/specs/ticketing-position-expiry-write/goldens/check-createorderwithposition-expiry.mjs

import { createOrderWithPosition } from '../../../../../../lib/orders.ts';
import { Timestamp } from 'firebase-admin/firestore';

const failures = [];
function assert(condition, message) {
  if (!condition) failures.push(message);
}

const writes = new Map(); // `${collection}/${id}` -> data

function makeFakeDb() {
  let autoId = 0;
  return {
    collection(name) {
      return {
        doc(id) {
          const resolvedId = id ?? `auto-${name}-${autoId++}`;
          return { id: resolvedId };
        },
      };
    },
    async runTransaction(fn) {
      const transaction = {
        set(ref, data) {
          // ref shape here is whatever collection.doc() returned above; the real
          // module always calls orders.doc()/tickets.doc() itself and threads the
          // resulting ref straight into transaction.set(), so recovering the
          // collection name requires collection().doc() to be call-site-tagged.
          writes.set(ref.__key, data);
        },
      };
      return fn(transaction);
    },
  };
}

// __key tagging: wrap doc() so each ref carries which collection it came from, without
// changing the OrdersCollectionLike/OrdersTransactionLike interfaces the real module
// depends on (both only ever touch `.id` and pass the ref straight to `transaction.set`).
function makeFakeDbWithKeys() {
  const base = makeFakeDb();
  return {
    ...base,
    collection(name) {
      const coll = base.collection(name);
      return {
        doc(id) {
          const ref = coll.doc(id);
          return { ...ref, __key: `${name}/${ref.id}` };
        },
      };
    },
  };
}

const expiresAt = Timestamp.fromMillis(Date.parse('2026-08-18T12:30:00Z'));

const result = await createOrderWithPosition(
  {
    bookingRef: 'BOOKREF02',
    showId: 'nationalShow',
    buyerName: 'Test Buyer',
    buyerEmail: 'buyer@example.invalid',
    attendeeName: 'Test Buyer',
    attendeeEmail: 'buyer@example.invalid',
    ticketType: 'exhibitor',
    amount: 0,
    orderStatus: 'reserved',
    positionStatus: 'reserved',
    idempotencyKey: 'idem-2',
    expiresAt,
    purchasedAt: null,
    gateway: 'payfast',
    gatewayPaymentId: null,
    m_payment_id: null,
    pf_payment_id: null,
  },
  { db: makeFakeDbWithKeys() }
);

const orderWrite = writes.get(`orders/${result.orderId}`);
const positionWrite = writes.get(`tickets/${result.ticketId}`);

assert(orderWrite !== undefined, 'order document was never written');
assert(positionWrite !== undefined, 'position document was never written');
assert(orderWrite?.expiresAt === expiresAt, 'order.expiresAt should equal the input expiresAt (existing behaviour)');
assert(
  positionWrite?.expiresAt !== undefined,
  'position.expiresAt is undefined — the position never got the field at all (the original defect)'
);
assert(
  positionWrite?.expiresAt === expiresAt,
  `position.expiresAt must be the EXACT SAME Timestamp instance as input.expiresAt — got ${JSON.stringify(positionWrite?.expiresAt)}`
);

if (failures.length > 0) {
  console.error('FAIL — createOrderWithPosition position expiresAt proof violated:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('PASS — createOrderWithPosition writes expiresAt onto the position, matching the order exactly.');
