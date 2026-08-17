#!/usr/bin/env node
// F10 (ticketing-foundation) — order/position two-write atomicity for a PAID ITN. Mission
// brief: "a paid ITN must write the order and its position(s) atomically". Proven against a
// FAKE, in-memory Firestore-shaped store — never live Firestore — by calling the REAL
// markOrderAndPositionPaidByPaymentId() (lib/orders.ts) with its injectable `deps.db`, the
// same technique F8's A4 (check-pair-write-atomicity.mjs) used for the CREATE path. This
// script proves the same property for the UPDATE path an existing 'reserved' order/position
// pair takes when a genuine payment arrives.
//
// The fake store models Firestore's own documented transaction semantics: every write inside
// a runTransaction() callback is staged, not committed, until the callback resolves; if the
// callback throws, everything staged is discarded. This is what makes "both documents or
// neither" provable without a live database.
//
// DIMENSION THAT VARIES ACROSS CASES: which one of the two documents' write is forced to
// fail (position in case 2, order in case 3) — checked personally to confirm case 3 is not
// redundant with case 2: a real implementation with two independent (non-transactional)
// writes issued in the wrong relative order could pass case 2 (order write happens first and
// "succeeds" before the position write fails) while still being non-atomic; case 3 forces the
// FIRST-issued write to fail and proves the second write never lands either, closing that gap.
//
// Run as: npx tsx contracts/checks/ticketing-f10-itn-repin/check-order-position-atomicity.mjs

import { markOrderAndPositionPaidByPaymentId } from '../../../lib/orders.ts';

const failures = [];

class FakeFirestore {
  constructor(seed, { failOn } = {}) {
    this.collections = {
      orders: new Map(Object.entries(seed.orders ?? {})),
      tickets: new Map(Object.entries(seed.tickets ?? {})),
    };
    this.failOn = failOn ?? null; // { collection, id }
    this.updateCount = { orders: 0, tickets: 0 };
  }

  collection(name) {
    const store = this.collections[name];
    return {
      doc: (id) => ({ id, __collection: name }),
      where: (field, op, value) => {
        if (op !== '==') throw new Error(`fake store only supports '==', got '${op}'`);
        const matches = () =>
          [...store.entries()]
            .filter(([, data]) => data[field] === value)
            .map(([id, data]) => ({ id, exists: true, data: () => data }));
        return {
          limit: () => ({ get: async () => ({ empty: matches().length === 0, docs: matches() }) }),
          get: async () => ({ empty: matches().length === 0, docs: matches() }),
        };
      },
    };
  }

  async runTransaction(fn) {
    const staged = [];
    const transaction = {
      get: async (ref) => {
        const data = this.collections[ref.__collection].get(ref.id);
        return data ? { id: ref.id, exists: true, data: () => data } : { id: ref.id, exists: false, data: () => undefined };
      },
      update: (ref, patch) => {
        if (this.failOn && this.failOn.collection === ref.__collection && this.failOn.id === ref.id) {
          throw new Error(`simulated Firestore update failure on '${ref.__collection}/${ref.id}'`);
        }
        staged.push({ ref, patch });
      },
      set: (ref, data) => {
        staged.push({ ref, patch: data, replace: true });
      },
    };
    const result = await fn(transaction);
    for (const { ref, patch, replace } of staged) {
      const current = this.collections[ref.__collection].get(ref.id) ?? {};
      this.collections[ref.__collection].set(ref.id, replace ? patch : { ...current, ...patch });
      this.updateCount[ref.__collection] += 1;
    }
    return result;
  }
}

function seedReservedPair(orderId, bookingRef, overrides = {}) {
  return {
    orders: {
      [orderId]: {
        showId: 'nationalShow',
        buyerName: 'Test Buyer',
        buyerEmail: 'buyer@example.com',
        amount: 250,
        status: 'reserved',
        m_payment_id: 'SAOC-2027-ATOMIC01',
        recoveryToken: 'test-recovery-token-not-real',
        ...overrides.order,
      },
    },
    tickets: {
      [bookingRef]: {
        bookingRef,
        showId: 'nationalShow',
        attendeeName: 'Test Attendee',
        attendeeEmail: 'attendee@example.com',
        ticketType: 'general-admission',
        status: 'reserved',
        orderId,
        ...overrides.position,
      },
    },
  };
}

const NOW = { toMillis: () => Date.parse('2027-02-10T09:00:00Z') };

// (1) Success path: both order and position transition to 'paid' together, correctly linked.
{
  const store = new FakeFirestore(seedReservedPair('order-1', 'SAOC-2027-ATOMICPOS1'));
  const outcome = await markOrderAndPositionPaidByPaymentId(
    { m_payment_id: 'SAOC-2027-ATOMIC01', gatewayPaymentId: 'pf-1', now: NOW },
    { db: store }
  );

  if (!outcome.committed) failures.push(`(1) Expected committed:true on the success path, got committed:false (reason: ${outcome.reason}).`);
  const order = store.collections.orders.get('order-1');
  const position = store.collections.tickets.get('SAOC-2027-ATOMICPOS1');
  if (order?.status !== 'paid') failures.push(`(1) order.status was '${order?.status}', expected 'paid'.`);
  if (position?.status !== 'paid') failures.push(`(1) position.status was '${position?.status}', expected 'paid'.`);
  if (order?.gatewayPaymentId !== 'pf-1') failures.push(`(1) order.gatewayPaymentId was '${order?.gatewayPaymentId}', expected 'pf-1'.`);
}

// (2) Atomicity: the POSITION write is forced to fail. Neither document may end up 'paid'.
{
  const store = new FakeFirestore(seedReservedPair('order-2', 'SAOC-2027-ATOMICPOS2', { order: { m_payment_id: 'SAOC-2027-ATOMIC02' } }), {
    failOn: { collection: 'tickets', id: 'SAOC-2027-ATOMICPOS2' },
  });

  let threw = false;
  try {
    await markOrderAndPositionPaidByPaymentId({ m_payment_id: 'SAOC-2027-ATOMIC02', gatewayPaymentId: 'pf-2', now: NOW }, { db: store });
  } catch {
    threw = true;
  }

  const order = store.collections.orders.get('order-2');
  if (!threw) failures.push('(2) markOrderAndPositionPaidByPaymentId did not reject when the position update was forced to fail.');
  if (order?.status === 'paid') {
    failures.push("(2) order.status was flipped to 'paid' even though the SAME transaction's position update failed — the pair was not written atomically.");
  }
}

// (3) Negative control on (2): forcing the ORDER write to fail instead must ALSO leave both
// documents 'reserved' — proving the rollback isn't an artefact of write ordering.
{
  const store = new FakeFirestore(seedReservedPair('order-3', 'SAOC-2027-ATOMICPOS3', { order: { m_payment_id: 'SAOC-2027-ATOMIC03' } }), {
    failOn: { collection: 'orders', id: 'order-3' },
  });

  let threw = false;
  try {
    await markOrderAndPositionPaidByPaymentId({ m_payment_id: 'SAOC-2027-ATOMIC03', gatewayPaymentId: 'pf-3', now: NOW }, { db: store });
  } catch {
    threw = true;
  }

  const order = store.collections.orders.get('order-3');
  const position = store.collections.tickets.get('SAOC-2027-ATOMICPOS3');
  if (!threw) failures.push('(3) markOrderAndPositionPaidByPaymentId did not reject when the order update was forced to fail.');
  if (order?.status === 'paid' || position?.status === 'paid') {
    failures.push('(3) A document was flipped to paid even though the order update in the same transaction failed — expected both to remain reserved.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: markOrderAndPositionPaidByPaymentId(), called against an injected in-memory fake ' +
    'store, flips an order and its position to paid together on success, and leaves BOTH ' +
    'untouched when either half of the pair-write fails — proven against a fake store that ' +
    "models Firestore's real transaction commit/rollback contract, never against live Firestore."
);
process.exit(0);
