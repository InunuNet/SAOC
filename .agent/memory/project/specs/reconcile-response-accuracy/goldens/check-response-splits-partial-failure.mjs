#!/usr/bin/env node
// reconcile-response-accuracy F1 — proves markOrdersAlertedForResponse() (lib/reconciliation.ts)
// correctly reshapes markOrdersAlerted()'s outcome into an HTTP-response-ready
// { alertedNow, alertBookkeepingFailed } split, against a FAKE, in-memory Firestore-shaped
// store modeling WriteBatch semantics — never live Firestore, never a running Next.js server
// (this contract is design-only; port 3400 is held by a BrowserAgent build at the time this
// golden was written).
//
// THE BUG THIS CLOSES: app/api/admin/reconcile-orders/route.ts (shipped in 5738f61) called
// markOrdersAlerted() inside a try/catch that only logged a failure — the response's
// `alertedNow` field kept listing every order id the route ATTEMPTED to alert, regardless of
// whether the bookkeeping write actually committed. A partial or total markOrdersAlerted
// failure produced a success-shaped body indistinguishable from a real success.
//
// THREE SCENARIOS, one FakeFirestore shared across them (same dialect as this contract's
// sibling order-reconciliation/goldens/check-partial-failure-atomicity.mjs — read that file's
// header before changing this one):
//
//   1. PARTIAL FAILURE — three orders attempted, order-B's batch commit is made to reject.
//      alertedNow must be exactly ['order-A', 'order-C']; alertBookkeepingFailed must be
//      exactly ['order-B']. A version that still returns alertedNow = all three (the original
//      bug, reintroduced) FAILS this. A version that returns alertedNow = [] for everything
//      (over-conservative, "when in doubt call it all failed") ALSO fails this — it would make
//      a real caller wrongly conclude order-A and order-C need re-alerting when they don't,
//      which is its own false conclusion this assertion rules out.
//
//   2. FULL SUCCESS — no injected failure. alertedNow must be exactly the attempted ids;
//      alertBookkeepingFailed must be an empty array (present, not omitted — an omitted field
//      is itself an ambiguous body a caller could misread as "not applicable" rather than
//      "nothing failed"). A version that always reports something as failed (the opposite
//      over-correction) FAILS this.
//
//   3. UNRECOGNIZED ERROR — deps.db.batch() throws a plain Error synchronously (something
//      markOrdersAlerted's documented contract does not shape into a MarkOrdersAlertedError,
//      e.g. an infra-level throw above the per-order Promise.allSettled). The conservative
//      fallback must fire: alertedNow = [] (empty), alertBookkeepingFailed = every attempted id.
//      A version that lets this scenario throw uncaught (crashing markOrdersAlertedForResponse
//      instead of returning a shaped result), or one that mistakes "some non-MarkOrdersAlertedError
//      was thrown" for "must have partially succeeded" and returns a nonempty alertedNow, FAILS
//      this — both would let a caller wrongly conclude something landed when nothing is proven
//      to have.
//
// Run as:
//   npx tsx .agent/memory/project/specs/reconcile-response-accuracy/goldens/check-response-splits-partial-failure.mjs

import { markOrdersAlertedForResponse } from '../../../../../../lib/reconciliation.ts';
import { Timestamp } from 'firebase-admin/firestore';

const failures = [];
const NOW = Timestamp.fromMillis(Date.parse('2026-08-19T12:00:00Z'));

/** Same minimal Firestore-shaped fake as check-partial-failure-atomicity.mjs — modeling
 *  `where('orderId', '==', x).get()` on `tickets`, `.doc(id)` on both collections, and a
 *  WriteBatch whose buffered `update()` calls only apply on a successful `commit()`.
 *  `failingOrderId` — if set, any batch that touches that order (its own doc OR one of its
 *  positions) rejects on commit(), leaving that batch's writes entirely unapplied.
 *  `batchThrows` — if set, `db.batch()` itself throws synchronously (models an unrecognized,
 *  infra-level failure above the per-order Promise.allSettled). */
class FakeFirestore {
  constructor({ failingOrderId = null, batchThrows = false } = {}) {
    this.failingOrderId = failingOrderId;
    this.batchThrows = batchThrows;
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
    if (this.batchThrows) {
      throw new Error('simulated infra-level failure — db.batch() itself is unavailable');
    }
    const store = { orders: this.orders, tickets: this.tickets };
    const pending = [];
    const failingOrderId = this.failingOrderId;
    return {
      update(ref, data) {
        pending.push({ ref, data });
      },
      async commit() {
        const touchesFailingOrder =
          failingOrderId !== null &&
          pending.some(
            ({ ref, data }) =>
              (ref.collectionName === 'orders' && ref.id === failingOrderId) ||
              (ref.collectionName === 'tickets' && data.reconciliationAlertedAt !== undefined &&
                store.tickets.get(ref.id)?.orderId === failingOrderId)
          );
        if (touchesFailingOrder) {
          throw new Error(`simulated commit failure for ${failingOrderId}'s batch`);
        }
        for (const { ref, data } of pending) {
          const collectionStore = store[ref.collectionName];
          collectionStore.set(ref.id, { ...collectionStore.get(ref.id), ...data });
        }
      },
    };
  }
}

function expectEqual(actual, expected, label) {
  const a = JSON.stringify([...actual].sort());
  const e = JSON.stringify([...expected].sort());
  if (a !== e) {
    failures.push(`${label}: expected ${e}, got ${a}`);
  }
}

// --- Scenario 1: partial failure ---------------------------------------------------------
{
  const db = new FakeFirestore({ failingOrderId: 'order-B' });
  const result = await markOrdersAlertedForResponse(['order-A', 'order-B', 'order-C'], NOW, { db });
  expectEqual(result.alertedNow, ['order-A', 'order-C'], 'Scenario 1 (partial failure) alertedNow');
  expectEqual(
    result.alertBookkeepingFailed,
    ['order-B'],
    'Scenario 1 (partial failure) alertBookkeepingFailed'
  );
}

// --- Scenario 2: full success --------------------------------------------------------------
{
  const db = new FakeFirestore({});
  const result = await markOrdersAlertedForResponse(['order-A', 'order-B', 'order-C'], NOW, { db });
  expectEqual(
    result.alertedNow,
    ['order-A', 'order-B', 'order-C'],
    'Scenario 2 (full success) alertedNow'
  );
  if (!Array.isArray(result.alertBookkeepingFailed) || result.alertBookkeepingFailed.length !== 0) {
    failures.push(
      `Scenario 2 (full success) alertBookkeepingFailed: expected an empty array (present, not ` +
        `omitted), got ${JSON.stringify(result.alertBookkeepingFailed)}`
    );
  }
}

// --- Scenario 3: unrecognized/infra-level error --------------------------------------------
{
  const db = new FakeFirestore({ batchThrows: true });
  const result = await markOrdersAlertedForResponse(['order-A', 'order-B', 'order-C'], NOW, { db });
  if (!Array.isArray(result.alertedNow) || result.alertedNow.length !== 0) {
    failures.push(
      `Scenario 3 (unrecognized error) alertedNow: expected an empty array (nothing proven to ` +
        `have committed), got ${JSON.stringify(result.alertedNow)}`
    );
  }
  expectEqual(
    result.alertBookkeepingFailed,
    ['order-A', 'order-B', 'order-C'],
    'Scenario 3 (unrecognized error) alertBookkeepingFailed'
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: markOrdersAlertedForResponse() correctly splits alertedNow/alertBookkeepingFailed under ' +
    'a partial batch-commit failure, a full success, and an unrecognized/infra-level error — a ' +
    'caller reading the response can no longer wrongly conclude an order was alerted when its ' +
    'bookkeeping write never committed.'
);
process.exit(0);
