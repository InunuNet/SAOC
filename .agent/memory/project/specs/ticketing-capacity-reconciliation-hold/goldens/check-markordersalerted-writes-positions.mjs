#!/usr/bin/env node
// ============================================================================================
// WITHDRAWN 2026-08-19 — this contract's F1 (the seat-hold feature this proof was written for)
// was reverted before shipping (@qa found the premise false — see
// .agent/memory/project/specs/ticketing-capacity-reconciliation-hold/WITHDRAWN.md). The
// markOrdersAlerted position-write this script exercises was itself KEPT (see WITHDRAWN.md
// "What was kept"), so this script will likely still technically pass if run — but it no
// longer proves anything meaningful about capacity-hold, because nothing in this codebase
// holds a seat on reconciliationAlertedAt anymore. Kept unexecuted, as historical record. Do
// not treat a pass here as evidence this feature is safe to re-enable — read WITHDRAWN.md
// first.
// ============================================================================================
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

// --- minimal fake Firestore-shaped store: two collections, chained equality where(), get(),
// and a batch() modeling real WriteBatch semantics (update() buffers, commit() applies all-or-
// nothing) — lib/reconciliation.ts's markOrdersAlerted now commits each order's order-doc and
// position-doc stamps as ONE atomic db.batch() (closing a Codex-confirmed silent-oversell
// defect: see lib/reconciliation.ts's markOrdersAlerted header "PER-ORDER ATOMICITY"), so a fake
// exposing only doc().update() no longer satisfies its call surface. Same fake pattern as
// order-reconciliation's check-partial-failure-atomicity.mjs (which exhaustively proves the
// atomic-failure property itself) — kept consistent with that dialect rather than inventing a
// second one. This golden's own scenarios are all-success; the batch fake still buffers+applies
// atomically here for structural consistency with the real WriteBatch contract, not because any
// assertion below exercises a failure path. ---

const orders = new Map([
  [ORDER_ID, { status: 'reserved', amount: 250, buyerEmail: 'buyer@example.invalid' }],
]);
const tickets = new Map([
  ['pos-a', { orderId: ORDER_ID, status: 'reserved' }],
  ['pos-b', { orderId: ORDER_ID, status: 'reserved' }],
  ['pos-c', { orderId: OTHER_ORDER_ID, status: 'reserved' }], // negative control
]);

const stores = { orders, tickets };

function makeCollection(collectionName) {
  const store = stores[collectionName];
  return {
    doc(id) {
      return { id, collectionName };
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
    if (name === 'orders' || name === 'tickets') return makeCollection(name);
    throw new Error(`unexpected collection ${name}`);
  },
  batch() {
    const pending = [];
    return {
      update(ref, data) {
        if (!stores[ref.collectionName]?.has(ref.id)) {
          throw new Error(`doc ${ref.collectionName}/${ref.id} does not exist`);
        }
        pending.push({ ref, data });
      },
      // Models the real all-or-nothing guarantee: every buffered write is applied only once
      // every one of them is known to be applicable — a rejected commit must leave NONE of
      // this batch's writes observable. No scenario in this golden makes commit() reject, but
      // the semantics are real, not a stub that always succeeds by construction.
      async commit() {
        for (const { ref, data } of pending) {
          Object.assign(stores[ref.collectionName].get(ref.id), data);
        }
      },
    };
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
