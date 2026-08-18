#!/usr/bin/env node
// ticketing-capacity-reconciliation-hold F1, A3 — proves markOrdersAlerted (lib/reconciliation.ts)
// now ALSO stamps reconciliationAlertedAt onto every position sharing the order's orderId,
// against a FAKE, in-memory Firestore-shaped store — never live Firestore. Same technique as
// order-reconciliation's check-detects-stranded-orders.mjs.
//
// Scenarios (all real defeating-mutation targets, see goldens/README.md "A3"):
//   - two positions sharing the alerted order's orderId -> BOTH get reconciliationAlertedAt.
//   - one position with a DIFFERENT orderId (negative control) -> untouched.
//   - the order's own status/amount -> unchanged (re-proves the existing "writes ONLY
//     reconciliationAlertedAt" boundary after the edit).
//
// Run as: npx tsx .agent/memory/project/specs/ticketing-capacity-reconciliation-hold/goldens/check-markordersalerted-writes-positions.mjs

import { markOrdersAlerted } from '../../../../../../lib/reconciliation.ts';
import { Timestamp } from 'firebase-admin/firestore';

const failures = [];
function assert(condition, message) {
  if (!condition) failures.push(message);
}

const NOW = Timestamp.fromMillis(Date.parse('2026-08-19T12:00:00Z'));
const ORDER_ID = 'order-alerted-1';
const OTHER_ORDER_ID = 'order-unrelated-1';

// --- minimal fake Firestore-shaped store: two collections, chained equality where(), get(), doc().update() ---

const orders = new Map([
  [ORDER_ID, { status: 'reserved', amount: 250, buyerEmail: 'buyer@example.invalid' }],
]);
const tickets = new Map([
  ['pos-a', { orderId: ORDER_ID, status: 'reserved' }],
  ['pos-b', { orderId: ORDER_ID, status: 'reserved' }],
  ['pos-c', { orderId: OTHER_ORDER_ID, status: 'reserved' }], // negative control
]);

function makeCollection(store) {
  return {
    doc(id) {
      return {
        update(data) {
          if (!store.has(id)) throw new Error(`doc ${id} does not exist`);
          Object.assign(store.get(id), data);
        },
      };
    },
    where(field, op, value) {
      if (op !== '==') throw new Error(`unsupported op ${op}`);
      const matches = () =>
        [...store.entries()]
          .filter(([, data]) => data[field] === value)
          .map(([id, data]) => ({ id, data: () => data }));
      return {
        get: async () => {
          const docs = matches();
          return { empty: docs.length === 0, docs };
        },
        where(field2, op2, value2) {
          // second-level chaining not needed by markOrdersAlerted; provided for interface parity.
          return this;
        },
      };
    },
  };
}

const fakeDb = {
  collection(name) {
    if (name === 'orders') return makeCollection(orders);
    if (name === 'tickets') return makeCollection(tickets);
    throw new Error(`unexpected collection ${name}`);
  },
};

await markOrdersAlerted([ORDER_ID], NOW, { db: fakeDb });

assert(
  tickets.get('pos-a').reconciliationAlertedAt === NOW,
  'pos-a (orderId matches alerted order) should have reconciliationAlertedAt stamped'
);
assert(
  tickets.get('pos-b').reconciliationAlertedAt === NOW,
  'pos-b (orderId matches alerted order) should have reconciliationAlertedAt stamped'
);
assert(
  tickets.get('pos-c').reconciliationAlertedAt === undefined,
  'pos-c (different orderId — negative control) must be untouched'
);
assert(
  orders.get(ORDER_ID).reconciliationAlertedAt === NOW,
  'existing behaviour: the order itself must still get reconciliationAlertedAt'
);
assert(
  orders.get(ORDER_ID).status === 'reserved' && orders.get(ORDER_ID).amount === 250,
  'money-state fields (status, amount) on the order must be unchanged — existing boundary'
);
assert(
  tickets.get('pos-a').status === 'reserved' && tickets.get('pos-b').status === 'reserved',
  'money-state fields (status) on the positions must be unchanged'
);

if (failures.length > 0) {
  console.error('FAIL — markOrdersAlerted position-write proof violated:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('PASS — markOrdersAlerted stamps reconciliationAlertedAt onto matching positions only, money-state fields unchanged.');
