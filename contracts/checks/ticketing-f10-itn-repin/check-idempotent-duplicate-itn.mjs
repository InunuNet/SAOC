#!/usr/bin/env node
// F10 (ticketing-foundation) — duplicate ITN delivery. PayFast retries ITN delivery until it
// receives HTTP 200 and CAN genuinely deliver the same valid notification twice in close
// succession (this route always returns 200 — see acknowledge() — so a slow response or a
// dropped acknowledgement reproduces this with no attacker involved). This proves a second,
// otherwise-valid delivery for an ALREADY-PAID order does not create a second write.
//
// FINDING, reported prominently per the dispatch instructions rather than silently fixed:
// this is genuinely UPDATE-based idempotency (markOrderAndPositionPaidByPaymentId only ever
// updates a pre-existing 'reserved' order/position pair — it never creates a document), so a
// duplicate delivery cannot structurally create a SECOND order or position the way a
// create-based path could. What it COULD still do wrong, and what this check actually proves,
// is re-run the paid transition itself: overwrite purchasedAt/gatewayPaymentId a second time,
// or (via the ITN route's own gating on `outcome.committed`) re-fire the confirmation email.
// The pre-F10 route had the identical guard shape at the single-document level (a positive
// `!== 'reserved'` check) — F10 carries that same protection to the order level, and this
// check proves it, rather than assuming it "obviously" still holds after the two-write
// rewrite.
//
// DIMENSION THAT VARIES ACROSS CASES: call count only (one call vs. two identical calls
// against the SAME store, same input). If markOrderAndPositionPaidByPaymentId's idempotency
// check were accidentally removed or weakened to something order-independent, this would show
// up as either a second update-count increment or the purchasedAt/gatewayPaymentId values
// disagreeing between reads — this check inspects both, not just "did it throw".
//
// Run as: npx tsx contracts/checks/ticketing-f10-itn-repin/check-idempotent-duplicate-itn.mjs

import { markOrderAndPositionPaidByPaymentId } from '../../../lib/orders.ts';

const failures = [];

class FakeFirestore {
  constructor(seed) {
    this.collections = {
      orders: new Map(Object.entries(seed.orders ?? {})),
      tickets: new Map(Object.entries(seed.tickets ?? {})),
    };
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
        staged.push({ ref, patch });
      },
    };
    const result = await fn(transaction);
    for (const { ref, patch } of staged) {
      const current = this.collections[ref.__collection].get(ref.id) ?? {};
      this.collections[ref.__collection].set(ref.id, { ...current, ...patch });
      this.updateCount[ref.__collection] += 1;
    }
    return result;
  }
}

function seed() {
  return {
    orders: {
      'order-dup-1': {
        showId: 'nationalShow',
        buyerName: 'Dup Buyer',
        buyerEmail: 'dupbuyer@example.com',
        amount: 250,
        status: 'reserved',
        m_payment_id: 'SAOC-2027-DUPITN01',
        recoveryToken: null,
      },
    },
    tickets: {
      'SAOC-2027-DUPPOS01': {
        bookingRef: 'SAOC-2027-DUPPOS01',
        showId: 'nationalShow',
        attendeeName: 'Dup Attendee',
        attendeeEmail: 'dupattendee@example.com',
        ticketType: 'general-admission',
        status: 'reserved',
        orderId: 'order-dup-1',
      },
    },
  };
}

const FIRST_NOW = { toMillis: () => Date.parse('2027-02-10T09:00:00Z') };
const SECOND_NOW = { toMillis: () => Date.parse('2027-02-10T09:05:00Z') }; // a later, genuinely different delivery time

const store = new FakeFirestore(seed());
const input = { m_payment_id: 'SAOC-2027-DUPITN01', gatewayPaymentId: 'pf-dup-1', now: FIRST_NOW };

const firstOutcome = await markOrderAndPositionPaidByPaymentId(input, { db: store });
if (!firstOutcome.committed) {
  failures.push(`First delivery did not commit (reason: ${firstOutcome.reason}) — cannot test duplicate-delivery behaviour against an already-broken first write.`);
}
const afterFirst = {
  order: { ...store.collections.orders.get('order-dup-1') },
  position: { ...store.collections.tickets.get('SAOC-2027-DUPPOS01') },
};

// Second, DUPLICATE delivery of the identical ITN, arriving later — a different `now`,
// exactly what a real retried/duplicate PayFast delivery looks like.
const secondOutcome = await markOrderAndPositionPaidByPaymentId(
  { ...input, now: SECOND_NOW },
  { db: store }
);

if (secondOutcome.committed) {
  failures.push('The SECOND (duplicate) delivery reported committed:true — it should have been a no-op (order already paid), not a fresh transition.');
}
if (secondOutcome.committed === false && secondOutcome.reason !== 'order-not-reserved') {
  failures.push(`The second delivery's refusal reason was '${secondOutcome.reason}', expected 'order-not-reserved' (the order was already paid by the first delivery).`);
}

if (store.updateCount.orders !== 1) {
  failures.push(`orders collection was updated ${store.updateCount.orders} time(s) across two identical deliveries — expected exactly 1 (no second write).`);
}
if (store.updateCount.tickets !== 1) {
  failures.push(`tickets collection was updated ${store.updateCount.tickets} time(s) across two identical deliveries — expected exactly 1 (no second write).`);
}

const afterSecond = {
  order: store.collections.orders.get('order-dup-1'),
  position: store.collections.tickets.get('SAOC-2027-DUPPOS01'),
};

// purchasedAt/gatewayPaymentId must be untouched by the second delivery — proves the no-op is
// genuine, not merely "still ends up looking the same by coincidence".
if (afterSecond.order.purchasedAt?.toMillis?.() !== afterFirst.order.purchasedAt?.toMillis?.()) {
  failures.push("The order's purchasedAt changed between the first and second delivery — the duplicate ITN re-ran the paid transition instead of no-opping.");
}
if (afterSecond.order.gatewayPaymentId !== afterFirst.order.gatewayPaymentId) {
  failures.push('gatewayPaymentId changed between the first and second delivery — the duplicate ITN was not a genuine no-op.');
}

// No second order or position document exists under any key — the create-based double-write
// failure mode this project has hardened against elsewhere (F8's A4) cannot occur here at all,
// because this path only ever updates, but this is asserted rather than assumed.
if (store.collections.orders.size !== 1) failures.push(`orders collection has ${store.collections.orders.size} document(s) after two deliveries — expected exactly 1.`);
if (store.collections.tickets.size !== 1) failures.push(`tickets collection has ${store.collections.tickets.size} document(s) after two deliveries — expected exactly 1.`);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a second, duplicate ITN delivery for an already-paid order is a genuine no-op — ' +
    'committed:false with reason order-not-reserved, no second Firestore write on either ' +
    'collection, and purchasedAt/gatewayPaymentId unchanged from the first delivery. Because ' +
    'this path is update-only (never create), no second order or position document can exist ' +
    'under any circumstance — proven, not assumed, by the final document-count check above. ' +
    "The ITN route gates the confirmation-email hookup on outcome.committed === true (see the " +
    'golden README and the pinned route itself), so this no-op also means the duplicate ' +
    'delivery cannot re-fire the confirmation email.'
);
process.exit(0);
