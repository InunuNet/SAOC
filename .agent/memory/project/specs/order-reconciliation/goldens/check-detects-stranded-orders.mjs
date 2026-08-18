#!/usr/bin/env node
// order-reconciliation F1 — proves the detection pipeline (findStrandedOrders +
// filterOrdersNeedingAlert, lib/reconciliation.ts) against a FAKE, in-memory Firestore-shaped
// store — never live Firestore — same technique as
// contracts/checks/ticketing-f8-comp-tickets/check-pair-write-atomicity.mjs.
//
// Five scenarios, each a real defeating-mutation target:
//   (1) reserved + expired            -> MUST be detected (the actual bug: a stranded order).
//   (2) reserved + NOT yet expired    -> MUST NOT be detected. This is the abandoned-checkout
//       negative control the mission brief calls out as "the crux of this feature" — a
//       detector that flags every 'reserved' order regardless of expiresAt would pass (1) but
//       fail this, and would spam a human with every mid-checkout customer.
//   (3) paid, with an old expiresAt   -> MUST NOT be detected. A detector that queries only on
//       expiresAt (forgetting the status=='reserved' filter) passes (1) but fails this.
//   (4) reserved + expired + alerted moments ago (inside the re-alert window) -> MUST be
//       excluded by filterOrdersNeedingAlert. Proves the idempotency guard: re-running
//       reconciliation seconds apart must not re-alert on the same order every time.
//   (5) reserved + expired + alerted long ago (outside the re-alert window, still unresolved)
//       -> MUST be included again. Proves the alert is a recurring reminder while the order
//       stays broken, not a permanent one-shot silence — a detector that treats
//       "reconciliationAlertedAt is set" as "done forever" passes (4) but fails this, and a
//       genuinely stranded order would silently stop being surfaced to a human after one email.
//
// Run as: npx tsx .agent/memory/project/specs/order-reconciliation/goldens/check-detects-stranded-orders.mjs

import {
  findStrandedOrders,
  filterOrdersNeedingAlert,
  RE_ALERT_WINDOW_MS,
} from '../../../../../../lib/reconciliation.ts';
import { Timestamp } from 'firebase-admin/firestore';

const failures = [];

const NOW_MS = Date.parse('2026-08-19T12:00:00Z');
const NOW = Timestamp.fromMillis(NOW_MS);

const ONE_HOUR_MS = 60 * 60 * 1000;

// A minimal Firestore-shaped fake supporting chained equality/less-than `where()` + `get()`,
// matching the read surface lib/reconciliation.ts's findStrandedOrders needs. Filters are
// applied in-memory against a flat array of fixture docs — this is a model of Firestore's
// documented query semantics, not a reimplementation of the detection business logic itself.
class FakeFirestore {
  constructor(docs) {
    this.docs = docs;
  }

  collection(name) {
    if (name !== 'orders') throw new Error(`unexpected collection queried: '${name}'`);
    return makeQuery(this.docs, []);
  }
}

function makeQuery(docs, filters) {
  return {
    where(field, op, value) {
      return makeQuery(docs, [...filters, { field, op, value }]);
    },
    async get() {
      const matched = docs.filter((doc) =>
        filters.every(({ field, op, value }) => {
          const actual = doc[field];
          const actualMs = actual instanceof Timestamp ? actual.toMillis() : actual;
          const expectedMs = value instanceof Timestamp ? value.toMillis() : value;
          if (op === '==') return actualMs === expectedMs;
          if (op === '<') return actualMs < expectedMs;
          throw new Error(`FakeFirestore does not model op '${op}'`);
        })
      );
      return {
        empty: matched.length === 0,
        docs: matched.map((doc) => ({
          id: doc.id,
          exists: true,
          data: () => doc,
        })),
      };
    },
  };
}

function order(id, overrides) {
  return {
    id,
    showId: 'nationalShow',
    buyerName: 'Test Buyer',
    buyerEmail: 'buyer@example.com',
    amount: 250,
    status: 'reserved',
    expiresAt: Timestamp.fromMillis(NOW_MS - ONE_HOUR_MS),
    idempotencyKey: `key-${id}`,
    purchasedAt: null,
    gateway: 'payfast',
    gatewayPaymentId: null,
    m_payment_id: `SAOC-${id}`,
    pf_payment_id: null,
    reconciliationAlertedAt: null,
    ...overrides,
  };
}

const fixtures = [
  order('stranded-expired', {}), // (1)
  order('reserved-not-expired', { expiresAt: Timestamp.fromMillis(NOW_MS + ONE_HOUR_MS) }), // (2)
  order('paid-old-expiry', {
    status: 'paid',
    expiresAt: Timestamp.fromMillis(NOW_MS - 30 * ONE_HOUR_MS),
    purchasedAt: Timestamp.fromMillis(NOW_MS - 30 * ONE_HOUR_MS),
  }), // (3)
  order('recently-alerted', {
    reconciliationAlertedAt: Timestamp.fromMillis(NOW_MS - 5 * 60 * 1000), // 5 min ago
  }), // (4)
  order('alerted-long-ago', {
    reconciliationAlertedAt: Timestamp.fromMillis(NOW_MS - RE_ALERT_WINDOW_MS - ONE_HOUR_MS),
  }), // (5)
];

const store = new FakeFirestore(fixtures);

const stranded = await findStrandedOrders(NOW, { db: store });
const strandedIds = stranded.map((o) => o.orderId).sort();

const expectedStrandedIds = [
  'alerted-long-ago',
  'recently-alerted',
  'stranded-expired',
].sort();
if (JSON.stringify(strandedIds) !== JSON.stringify(expectedStrandedIds)) {
  failures.push(
    `findStrandedOrders returned [${strandedIds.join(', ')}], expected [${expectedStrandedIds.join(', ')}] ` +
      "— it must select status=='reserved' AND expiresAt < now, nothing more and nothing less."
  );
}

const needingAlert = filterOrdersNeedingAlert(stranded, NOW);
const needingAlertIds = needingAlert.map((o) => o.orderId).sort();
const expectedNeedingAlertIds = ['alerted-long-ago', 'stranded-expired'].sort();
if (JSON.stringify(needingAlertIds) !== JSON.stringify(expectedNeedingAlertIds)) {
  failures.push(
    `filterOrdersNeedingAlert returned [${needingAlertIds.join(', ')}], expected ` +
      `[${expectedNeedingAlertIds.join(', ')}] — 'recently-alerted' (inside RE_ALERT_WINDOW_MS) ` +
      "must be excluded, 'alerted-long-ago' (outside it) must be re-included."
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: findStrandedOrders() selects exactly the reserved+expired orders (not abandoned ' +
    'mid-checkout carts, not paid orders with a stale old expiry) and filterOrdersNeedingAlert() ' +
    're-surfaces a still-unresolved order after RE_ALERT_WINDOW_MS instead of silencing it ' +
    'forever after one alert — proven against a fake store, never live Firestore.'
);
process.exit(0);
