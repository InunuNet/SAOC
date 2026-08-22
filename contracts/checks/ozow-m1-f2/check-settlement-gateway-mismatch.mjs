#!/usr/bin/env node
// A13 — Codex GPT-5.5 cross-model review (2026-08-22): markOrderAndPositionPaidByPaymentId
// (lib/orders.ts) settled an order using ONLY its payment reference (m_payment_id) and the
// notification's own data — it never checked that the order it resolved was actually CREATED
// under the same provider that is currently confirming it (paymentProvider.id, threaded from
// lib/tickets-notification.ts's shared 11-step handler). Concretely: if a PayFast ITN notification
// arrives referencing an m_payment_id/orderId that resolves to an order actually created with
// gateway: 'ozow' (an id collision, a replayed/forged notification, or any scenario where the
// reference values overlap across providers), the pre-fix code would settle that Ozow order using
// the PayFast notification's data — a money/state integrity bug: the wrong provider's confirmation
// marking a different provider's order paid.
//
// THE FIX: MarkOrderAndPositionPaidInput gained a required `expectedGateway` field (lib/orders.ts)
// — the id of the provider CURRENTLY processing this notification. Inside
// markOrderAndPositionPaidByPaymentId's transaction, immediately after the existing
// order-payment-id-mismatch identity check and before the order-not-reserved status check, the
// resolved order's stored `gateway` field is compared against `input.expectedGateway`; a
// disagreement returns `{ committed: false, reason: 'order-gateway-mismatch', storedGateway,
// expectedGateway }` and the order is left untouched — never settled. lib/tickets-notification.ts
// passes `expectedGateway: paymentProvider.id` (the provider whose route is CURRENTLY calling the
// shared handler) and logs both the stored and expected gateway loudly on rejection, matching the
// existing order-payment-id-mismatch rejection pattern in that file.
//
// This check drives the REAL markOrderAndPositionPaidByPaymentId (lib/orders.ts) against a fake
// Firestore, same harness pattern as check-idempotent-duplicate-itn.mjs
// (ticketing-f10-itn-repin) and check-order-position-atomicity.mjs. Two cases:
//   (1) CORE DEFECT, both directions: an order stored with gateway:'ozow' notified via the
//       PayFast path (expectedGateway:'payfast'), and the symmetric case (stored 'payfast',
//       notified via 'ozow') — both must be rejected with reason 'order-gateway-mismatch', and
//       the order/position must remain untouched (still 'reserved', zero Firestore updates).
//   (2) NEGATIVE CONTROL: the ordinary, non-attack case — an order's stored gateway matches the
//       notifying provider — must still commit exactly as before. This is the live path every
//       real PayFast and Ozow payment already depends on and must never regress while fixing (1).
//
// REVERT-AND-CONFIRM-RED: this check is run once against the CURRENT (fixed) lib/orders.ts, and
// once with the `order?.gateway !== input.expectedGateway` guard commented out (simulating the
// pre-fix code) via ORDERS_TS_SKIP_GATEWAY_CHECK, to prove case (1) actually catches the original
// defect rather than passing vacuously. See check-settlement-gateway-mismatch.sh for that half.
//
// Run as: npx tsx contracts/checks/ozow-m1-f2/check-settlement-gateway-mismatch.mjs

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

function seed({ orderId, mPaymentId, bookingRef, gateway }) {
  return {
    orders: {
      [orderId]: {
        showId: 'nationalShow',
        buyerName: 'Gateway Mismatch',
        buyerEmail: 'gateway-mismatch@saoc-check.invalid',
        amount: 500,
        status: 'reserved',
        m_payment_id: mPaymentId,
        gateway,
        recoveryToken: null,
      },
    },
    tickets: {
      [bookingRef]: {
        bookingRef,
        showId: 'nationalShow',
        attendeeName: 'Gateway Mismatch',
        attendeeEmail: 'gateway-mismatch@saoc-check.invalid',
        ticketType: 'general-admission',
        status: 'reserved',
        orderId,
      },
    },
  };
}

const NOW = { toMillis: () => Date.parse('2027-02-10T09:00:00Z') };

// -------------------------------------------------------------------------------------------
// (1a) CORE DEFECT: order created under Ozow, notification arrives via the PayFast route.
// -------------------------------------------------------------------------------------------
{
  const orderId = 'order-ozow-notified-payfast';
  const mPaymentId = 'SAOC-2027-GWMISMATCH01';
  const bookingRef = 'SAOC-2027-GWMISMATCH01POS';
  const store = new FakeFirestore(seed({ orderId, mPaymentId, bookingRef, gateway: 'ozow' }));

  const outcome = await markOrderAndPositionPaidByPaymentId(
    { m_payment_id: mPaymentId, gatewayPaymentId: 'pf-attempted-1', now: NOW, orderId, expectedGateway: 'payfast' },
    { db: store }
  );

  if (outcome.committed) {
    failures.push(
      '(1a) CORE DEFECT: an order created under gateway="ozow" was SETTLED by a notification ' +
        'processed via the PayFast route (expectedGateway="payfast") — committed:true. This is ' +
        'the exact money-routing integrity bug this check exists to catch.'
    );
  } else if (outcome.reason !== 'order-gateway-mismatch') {
    failures.push(`(1a) expected reason 'order-gateway-mismatch', got '${outcome.reason}'.`);
  } else if (outcome.storedGateway !== 'ozow' || outcome.expectedGateway !== 'payfast') {
    failures.push(
      `(1a) rejection reason was correct but diagnostic fields were wrong: storedGateway=` +
        `'${outcome.storedGateway}' (expected 'ozow'), expectedGateway='${outcome.expectedGateway}' (expected 'payfast').`
    );
  } else {
    console.log("PASS (1a): order stored under 'ozow', notified via 'payfast' -> rejected with reason 'order-gateway-mismatch'.");
  }

  const orderAfter = store.collections.orders.get(orderId);
  const positionAfter = store.collections.tickets.get(bookingRef);
  if (orderAfter.status !== 'reserved') failures.push(`(1a) order.status changed to '${orderAfter.status}' — must remain 'reserved'.`);
  if (positionAfter.status !== 'reserved') failures.push(`(1a) position.status changed to '${positionAfter.status}' — must remain 'reserved'.`);
  if (store.updateCount.orders !== 0) failures.push(`(1a) orders collection was updated ${store.updateCount.orders} time(s) — expected 0 (no write on rejection).`);
  if (store.updateCount.tickets !== 0) failures.push(`(1a) tickets collection was updated ${store.updateCount.tickets} time(s) — expected 0.`);
}

// -------------------------------------------------------------------------------------------
// (1b) SYMMETRIC CASE: order created under PayFast, notification arrives via the Ozow route.
// -------------------------------------------------------------------------------------------
{
  const orderId = 'order-payfast-notified-ozow';
  const mPaymentId = 'SAOC-2027-GWMISMATCH02';
  const bookingRef = 'SAOC-2027-GWMISMATCH02POS';
  const store = new FakeFirestore(seed({ orderId, mPaymentId, bookingRef, gateway: 'payfast' }));

  const outcome = await markOrderAndPositionPaidByPaymentId(
    { m_payment_id: mPaymentId, gatewayPaymentId: 'ozow-attempted-1', now: NOW, orderId, expectedGateway: 'ozow' },
    { db: store }
  );

  if (outcome.committed) {
    failures.push(
      "(1b) SYMMETRIC DEFECT: an order created under gateway='payfast' was SETTLED by a " +
        "notification processed via the Ozow route (expectedGateway='ozow') — committed:true."
    );
  } else if (outcome.reason !== 'order-gateway-mismatch') {
    failures.push(`(1b) expected reason 'order-gateway-mismatch', got '${outcome.reason}'.`);
  } else {
    console.log("PASS (1b): order stored under 'payfast', notified via 'ozow' -> rejected with reason 'order-gateway-mismatch'.");
  }

  if (store.updateCount.orders !== 0) failures.push(`(1b) orders collection was updated ${store.updateCount.orders} time(s) — expected 0.`);
  if (store.updateCount.tickets !== 0) failures.push(`(1b) tickets collection was updated ${store.updateCount.tickets} time(s) — expected 0.`);
}

// -------------------------------------------------------------------------------------------
// (2) NEGATIVE CONTROL: the ordinary, non-attack case — stored gateway matches the notifying
// provider — must still commit exactly as before. This is the live PayFast AND Ozow purchase
// path this fix must never regress.
// -------------------------------------------------------------------------------------------
for (const provider of ['payfast', 'ozow']) {
  const orderId = `order-${provider}-control`;
  const mPaymentId = `SAOC-2027-GWCONTROL-${provider.toUpperCase()}`;
  const bookingRef = `${mPaymentId}POS`;
  const store = new FakeFirestore(seed({ orderId, mPaymentId, bookingRef, gateway: provider }));

  const outcome = await markOrderAndPositionPaidByPaymentId(
    { m_payment_id: mPaymentId, gatewayPaymentId: `${provider}-real-1`, now: NOW, orderId, expectedGateway: provider },
    { db: store }
  );

  if (!outcome.committed) {
    failures.push(
      `(2) NEGATIVE CONTROL FAILED for provider='${provider}': a genuine same-provider ` +
        `settlement was rejected (reason: ${outcome.reason}) — this must always commit.`
    );
  } else {
    const orderAfter = store.collections.orders.get(orderId);
    const positionAfter = store.collections.tickets.get(bookingRef);
    if (orderAfter.status !== 'paid') failures.push(`(2) [${provider}] order.status was '${orderAfter.status}', expected 'paid'.`);
    if (positionAfter.status !== 'paid') failures.push(`(2) [${provider}] position.status was '${positionAfter.status}', expected 'paid'.`);
    if (!failures.some((f) => f.startsWith(`(2) [${provider}]`))) {
      console.log(`PASS (2/${provider}): order and notification both under '${provider}' -> committed:true, order+position marked 'paid' (unaffected by the fix).`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} failure(s).`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

console.log(
  '\nPASS: a settlement notification whose currently-processing provider disagrees with the ' +
    "order's stored gateway is rejected (reason 'order-gateway-mismatch') with zero Firestore " +
    'writes on either collection, in both directions (ozow order/payfast notification and ' +
    'payfast order/ozow notification), while a genuine same-provider settlement for both ' +
    'PayFast and Ozow still commits and marks the order+position paid exactly as before.'
);
process.exit(0);
