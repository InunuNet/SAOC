#!/usr/bin/env node
// order-reconciliation F1 — proves markOrdersAlerted() (lib/reconciliation.ts) is atomic
// PER ORDER and isolated ACROSS orders, against a FAKE, in-memory Firestore-shaped store that
// models WriteBatch semantics — never live Firestore. Added closing a Codex GPT-5.5
// cross-model review FAIL: the original implementation wrote an order's
// `reconciliationAlertedAt` and its position(s)' stamp as two INDEPENDENT `doc().update()`
// calls inside a bare `Promise.all`, so an order-write-succeeds/ticket-write-fails split left
// the order stamp suppressing re-alerting for RE_ALERT_WINDOW_MS while the un-stamped ticket
// still released the seat via `stillHoldsSeat` (lib/data/tickets.ts) — a silent oversell with
// no second alert to catch it. See lib/reconciliation.ts's markOrdersAlerted header
// ("PER-ORDER ATOMICITY") for the fix.
//
// Three orders, one deliberately made to fail its batch commit:
//   order-A (succeeds) — one position (ticket-A1).
//   order-B (FAILS)    — its batch.commit() is made to reject; has one position (ticket-B1).
//   order-C (succeeds) — one position (ticket-C1), proving order-B's failure does not block or
//                         corrupt an unrelated order's independent batch.
//
// The actual defect this proves shut: after markOrdersAlerted() runs (and throws, which is
// itself asserted — a swallowed error would be a regression too), order-B's OWN doc must have
// NO reconciliationAlertedAt (no partial write leaving the order stamped without its ticket), AND
// ticket-B1 must independently have NO reconciliationAlertedAt either (the specific oversell
// scenario: order marked, seat not) — while order-A/ticket-A1 and order-C/ticket-C1 are BOTH
// fully stamped, proving per-order isolation. A version that reverted to two independent
// `doc().update()` calls per order (rather than one atomic batch) would pass the "order-B
// fails" half by accident but could not reliably produce "ticket-B1 is ALSO unstamped" — that
// only holds if the order and ticket writes are genuinely one atomic unit.
//
// Run as:
//   npx tsx .agent/memory/project/specs/order-reconciliation/goldens/check-partial-failure-atomicity.mjs

import { markOrdersAlerted } from '../../../../../../lib/reconciliation.ts';
import { Timestamp } from 'firebase-admin/firestore';

const failures = [];

const NOW = Timestamp.fromMillis(Date.parse('2026-08-19T12:00:00Z'));
const FAILING_ORDER_ID = 'order-B';

// A minimal Firestore-shaped fake modeling exactly the two collections + WriteBatch semantics
// markOrdersAlerted needs: `where('orderId', '==', x).get()` on `tickets`, `.doc(id)` on both
// collections, and `db.batch()` returning an object that buffers `update()` calls and only
// applies them to the backing store on a successful `commit()` — a rejected commit must leave
// every buffered write for that batch un-applied, which is the actual property under test.
class FakeFirestore {
  constructor() {
    this.orders = new Map([
      ['order-A', {}],
      ['order-B', {}],
      ['order-C', {}],
    ]);
    this.tickets = new Map([
      ['ticket-A1', { orderId: 'order-A' }],
      ['ticket-B1', { orderId: 'order-B' }],
      ['ticket-C1', { orderId: 'order-C' }],
    ]);
  }

  collection(name) {
    const store = name === 'orders' ? this.orders : name === 'tickets' ? this.tickets : null;
    if (!store) throw new Error(`unexpected collection queried: '${name}'`);
    const collectionName = name;
    return {
      where(field, op, value) {
        if (op !== '==') throw new Error(`FakeFirestore does not model op '${op}'`);
        return {
          async get() {
            const matched = [...store.entries()].filter(([, doc]) => doc[field] === value);
            return {
              empty: matched.length === 0,
              docs: matched.map(([id, doc]) => ({ id, data: () => doc })),
            };
          },
        };
      },
      doc(id) {
        return { id, collectionName };
      },
    };
  }

  batch() {
    const store = { orders: this.orders, tickets: this.tickets };
    const pending = [];
    return {
      update(ref, data) {
        pending.push({ ref, data });
      },
      async commit() {
        // Model a real WriteBatch: if ANY write in this batch touches the doomed order, the
        // WHOLE commit rejects and NONE of this batch's writes are applied — proving the order
        // stamp and its position stamp(s) really are one atomic unit, not two independent calls
        // that happen to usually succeed together.
        const touchesFailingOrder = pending.some(
          ({ ref, data }) =>
            (ref.collectionName === 'orders' && ref.id === FAILING_ORDER_ID) ||
            (ref.collectionName === 'tickets' && data.reconciliationAlertedAt !== undefined &&
              store.tickets.get(ref.id)?.orderId === FAILING_ORDER_ID)
        );
        if (touchesFailingOrder) {
          throw new Error(`simulated commit failure for ${FAILING_ORDER_ID}'s batch`);
        }
        for (const { ref, data } of pending) {
          const collectionStore = store[ref.collectionName];
          collectionStore.set(ref.id, { ...collectionStore.get(ref.id), ...data });
        }
      },
    };
  }
}

const db = new FakeFirestore();

let thrown = null;
try {
  await markOrdersAlerted(['order-A', 'order-B', 'order-C'], NOW, { db });
} catch (error) {
  thrown = error;
}

if (!thrown) {
  failures.push(
    'markOrdersAlerted() resolved without throwing even though order-B\'s batch commit was ' +
      'made to fail — a partial failure must be surfaced to the caller, not swallowed.'
  );
} else if (!String(thrown.message).includes(FAILING_ORDER_ID)) {
  failures.push(
    `markOrdersAlerted() threw, but its error message does not name the failed order id ` +
      `('${FAILING_ORDER_ID}'): "${thrown.message}"`
  );
}

// The failed order: NEITHER its own stamp NOR its ticket's stamp may be observable — this is
// the all-or-nothing property the fix exists to guarantee.
if (db.orders.get('order-B').reconciliationAlertedAt) {
  failures.push(
    'order-B.reconciliationAlertedAt was set even though its batch commit failed — the write ' +
      'was not actually atomic (order stamp landed without its position stamp).'
  );
}
if (db.tickets.get('ticket-B1').reconciliationAlertedAt) {
  failures.push(
    'ticket-B1.reconciliationAlertedAt was set even though order-B\'s batch commit failed — ' +
      'this is the exact oversell scenario the fix closes: a stamped seat with no matching ' +
      'order stamp (or here, the reverse) means stillHoldsSeat/re-alerting can disagree.'
  );
}

// The two unrelated, successful orders must be fully, independently stamped — order-B's
// failure must not block or corrupt them.
for (const [orderId, ticketId] of [
  ['order-A', 'ticket-A1'],
  ['order-C', 'ticket-C1'],
]) {
  if (!db.orders.get(orderId).reconciliationAlertedAt) {
    failures.push(
      `${orderId}.reconciliationAlertedAt was NOT set — order-B's failure must not block an ` +
        'unrelated order\'s independent batch from committing.'
    );
  }
  if (!db.tickets.get(ticketId).reconciliationAlertedAt) {
    failures.push(
      `${ticketId}.reconciliationAlertedAt was NOT set — order-B's failure must not block an ` +
        'unrelated order\'s independent batch from committing.'
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: markOrdersAlerted() commits each order\'s reconciliationAlertedAt stamp and its ' +
    'position stamp(s) as one atomic WriteBatch — a failed commit leaves NEITHER the order nor ' +
    'its ticket(s) stamped, the failure is thrown (not swallowed) and names the failed order, ' +
    'and an unrelated order\'s independent batch still commits successfully.'
);
process.exit(0);
