#!/usr/bin/env node
// F8 (ticketing-foundation) — order/position pair-write atomicity (mission brief: "The order
// and its position(s) are written as a PAIR. A mutation that writes the order but not the
// positions (or vice versa) must DIE."). Proven against a FAKE, in-memory Firestore-shaped
// store — never live Firestore — by calling the REAL, extended createOrderWithPosition()
// (lib/orders.ts) with its new injectable `deps.db` parameter, added by F8 for exactly this
// purpose (F2 shipped the function with a hardcoded `getFirestore(initAdmin())`, uninjectable —
// see that file's own docstring, which already names F8 as an intended caller).
//
// The fake store models Firestore's own documented transaction semantics: every write inside a
// runTransaction() callback is staged, not committed, until the callback resolves; if the
// callback throws, everything staged is discarded, not partially applied. This is the property
// that makes "both documents or neither" provable at all without a live database — it is a
// model of the commit/rollback CONTRACT the real Firestore SDK already guarantees, not a
// reimplementation of createOrderWithPosition's own business logic.
//
// Uses `npx tsx`, not `node --import tsx/esm` — this file imports lib/orders.ts, which has a
// real (non-type-only) import of `@/lib/firebase-admin`. `node --import tsx/esm` does not
// resolve the `@/*` tsconfig path alias at runtime and fails with "Cannot find module
// '@/lib/firebase-admin'"; `npx tsx` does, matching F2's own precedent
// (contracts/contract-ticketing-f2-orders-model.yaml A4/A5 vs A6-A7). See the golden README's
// "npx tsx vs node --import tsx/esm" note for future contract authors.
//
// Run as: npx tsx contracts/checks/ticketing-f8-comp-tickets/check-pair-write-atomicity.mjs

import { buildCompOrderInput } from '../../../lib/comp-tickets.ts';
import { createOrderWithPosition } from '../../../lib/orders.ts';

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

  async runTransaction(fn) {
    const staged = [];
    const transaction = {
      set: (ref, data) => {
        if (this.failOnCollection === ref.__collection) {
          throw new Error(`simulated Firestore write failure on collection '${ref.__collection}'`);
        }
        staged.push({ ref, data });
      },
    };

    // Only reachable if fn() didn't throw/reject — everything staged commits together, exactly
    // the Firestore transaction contract (nothing partially applied on failure).
    const result = await fn(transaction);
    for (const { ref, data } of staged) {
      this.committed[ref.__collection].set(ref.id, data);
    }
    return result;
  }
}

const NOW = new Date('2027-02-10T09:00:00Z');

function buildInput(bookingRef) {
  return buildCompOrderInput({
    showId: 'nationalShow',
    attendeeName: 'Test Attendee',
    attendeeEmail: 'attendee@example.com',
    ticketType: 'general-admission',
    issuedByEmail: 'manager@example.com',
    bookingRef,
    now: NOW,
  });
}

// (1) Success path: both documents land in the fake store, correctly linked and shaped.
{
  const store = new FakeFirestore();
  const input = buildInput('SAOC-2027-COMPTEST01');
  const result = await createOrderWithPosition(input, { db: store });

  const order = store.committed.orders.get(result.orderId);
  const position = store.committed.tickets.get(result.ticketId);

  if (!order) failures.push('(1) No order document was committed to the fake store on the success path.');
  if (!position) failures.push('(1) No position document was committed to the fake store on the success path.');
  if (order && position) {
    if (position.orderId !== result.orderId) {
      failures.push(`(1) position.orderId ('${position.orderId}') does not equal the order's resolved id ('${result.orderId}').`);
    }
    if (order.gateway !== 'comp') failures.push(`(1) order.gateway was '${order.gateway}', expected 'comp'.`);
    if (order.amount !== 0) failures.push(`(1) order.amount was ${order.amount}, expected 0.`);
    if (order.status !== 'paid') failures.push(`(1) order.status was '${order.status}', expected 'paid'.`);
    if (position.status !== 'paid') failures.push(`(1) position.status was '${position.status}', expected 'paid'.`);
    if (position.compedBy !== 'manager@example.com') {
      failures.push(`(1) position.compedBy was '${position.compedBy}', expected 'manager@example.com'.`);
    }
  }
}

// (2) Atomicity: the POSITION write is forced to fail. If the real implementation genuinely
// routes both writes through ONE transaction, the whole call rejects and NEITHER document is
// committed — not even the order, whose write was issued first. A mutation that instead performs
// two independent, non-transactional writes (e.g. `db.collection('orders').doc(id).set(order)`
// called directly, outside runTransaction, followed by a separately transactional position
// write) would leave the order committed here even though the position failed — that is exactly
// the defeating mutation this case exists to catch.
{
  const store = new FakeFirestore({ failOnCollection: 'tickets' });
  const input = buildInput('SAOC-2027-COMPTEST02');

  let threw = false;
  try {
    await createOrderWithPosition(input, { db: store });
  } catch {
    threw = true;
  }

  if (!threw) {
    failures.push('(2) createOrderWithPosition() did not reject when the position write was forced to fail — expected the transaction to abort.');
  }
  if (store.committed.orders.size !== 0) {
    failures.push(
      `(2) ${store.committed.orders.size} order document(s) were committed even though the position write in the SAME transaction failed — the pair was not written atomically.`,
    );
  }
  if (store.committed.tickets.size !== 0) {
    failures.push(`(2) ${store.committed.tickets.size} position document(s) were committed even though the write failed — expected zero.`);
  }
}

// (3) Negative control on (2): forcing the ORDER write to fail instead must ALSO leave both
// collections empty — proving the rollback isn't an artefact of write ordering (only the second
// write's failure being caught).
{
  const store = new FakeFirestore({ failOnCollection: 'orders' });
  const input = buildInput('SAOC-2027-COMPTEST03');

  let threw = false;
  try {
    await createOrderWithPosition(input, { db: store });
  } catch {
    threw = true;
  }

  if (!threw) {
    failures.push('(3) createOrderWithPosition() did not reject when the order write was forced to fail — expected the transaction to abort.');
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
  'PASS: createOrderWithPosition(), called with an injected in-memory fake store, writes a ' +
    "comp order and its position as a single atomic pair — correctly linked and shaped on the " +
    "success path, and with NEITHER document committed when either half of the pair's write " +
    "fails — proven against a fake store that models Firestore's real transaction " +
    'commit/rollback contract, never against live Firestore.',
);
process.exit(0);
