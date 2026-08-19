// F2 (payment-provider-seam) — regression suite for the lib/orders.ts:274 query race, per
// .agent/memory/project/specs/payment-provider-seam/orders-query-race-spec.md §4 (R1-R4).
//
// OFFLINE AND DETERMINISTIC BY DESIGN — every case below drives markOrderAndPositionPaidByPaymentId
// (and, for R3, _itn-harness.mts's waitUntilQueryable) through the deps.db injection point with a
// plain in-memory fake. No Firestore, no network, no credentials. That injection point is what
// @architect verified on 2026-08-19 drives the real function end to end (see the golden README's
// A30/A31 sweep finding referenced in the spec) — this suite reuses it rather than reinventing a
// second seam.
//
// EVERY CASE HERE HAS BEEN OBSERVED RED AGAINST THE PRE-FIX lib/orders.ts (git stash the fix,
// re-run, confirm non-zero exit + the expected failure) BEFORE this file was trusted. See the
// dev report for the red-then-green transcript; the spec is explicit that R2 in particular must
// never be trusted un-broken — "if R2 comes back GREEN against unfixed code, stop".
//
// Run: npx tsx contracts/checks/payfast-m1/check-orders-query-race-regression.mts
import { Timestamp } from 'firebase-admin/firestore';

import {
  markOrderAndPositionPaidByPaymentId,
  type OrdersFirestoreRwLike,
  type OrdersDocRefLike,
  type OrdersDocSnapshotLike,
  type OrdersQuerySnapshotLike,
} from '../../../lib/orders';
import { waitUntilQueryable } from './_itn-harness.mts';

// ---------------------------------------------------------------------------------------------
// Minimal in-memory fake satisfying OrdersFirestoreRwLike. Two collections ('orders',
// 'tickets'), each a plain Map<id, data>. `forceWhereEmpty` lets a case simulate the exact
// observed production condition — the where() index query returns empty while the document is
// present and reachable by ref — without needing two real, disagreeing Firestore index reads.
// ---------------------------------------------------------------------------------------------
class FakeCollection {
  readonly store = new Map<string, Record<string, unknown>>();
  whereCallCount = 0;
  forceWhereEmpty = false;
  private nextAutoId = 0;

  constructor(private readonly name: string) {}

  doc(id?: string): OrdersDocRefLike {
    const resolvedId = id ?? `${this.name}-auto-${(this.nextAutoId += 1)}`;
    return { id: resolvedId };
  }

  where(field: string, _op: '==', value: unknown) {
    this.whereCallCount += 1;
    const forceEmpty = this.forceWhereEmpty;
    const store = this.store;
    return {
      limit: (_n: number) => ({
        get: async (): Promise<OrdersQuerySnapshotLike> => {
          if (forceEmpty) return { empty: true, docs: [] };
          const hit = [...store.entries()].find(([, data]) => data[field] === value);
          if (!hit) return { empty: true, docs: [] };
          const [id, data] = hit;
          return { empty: false, docs: [{ id, exists: true, data: () => data }] };
        },
      }),
      get: async (): Promise<OrdersQuerySnapshotLike> => {
        if (forceEmpty) return { empty: true, docs: [] };
        const hit = [...store.entries()].find(([, data]) => data[field] === value);
        if (!hit) return { empty: true, docs: [] };
        const [id, data] = hit;
        return { empty: false, docs: [{ id, exists: true, data: () => data }] };
      },
    };
  }
}

class FakeDb implements OrdersFirestoreRwLike {
  readonly orders = new FakeCollection('orders');
  readonly tickets = new FakeCollection('tickets');

  collection(name: string) {
    if (name === 'orders') return this.orders as unknown as ReturnType<OrdersFirestoreRwLike['collection']>;
    if (name === 'tickets') return this.tickets as unknown as ReturnType<OrdersFirestoreRwLike['collection']>;
    throw new Error(`FakeDb: unexpected collection "${name}"`);
  }

  async runTransaction<T>(fn: (transaction: FakeTransaction) => Promise<T> | T): Promise<T> {
    return fn(new FakeTransaction(this));
  }
}

class FakeTransaction {
  constructor(private readonly db: FakeDb) {}

  async get(ref: OrdersDocRefLike): Promise<OrdersDocSnapshotLike> {
    const data = this.db.orders.store.get(ref.id) ?? this.db.tickets.store.get(ref.id);
    if (data === undefined) {
      return { id: ref.id, exists: false, data: () => undefined };
    }
    return { id: ref.id, exists: true, data: () => data };
  }

  set(): unknown {
    return undefined;
  }

  update(): unknown {
    return undefined;
  }
}

function reservedOrder(overrides: Record<string, unknown> = {}) {
  return {
    showId: 'nationalShow',
    buyerName: 'Race Regression',
    buyerEmail: 'race-regression@saoc-check.invalid',
    amount: 0,
    status: 'reserved',
    expiresAt: null,
    idempotencyKey: 'race-regression-key',
    purchasedAt: null,
    gateway: 'payfast',
    gatewayPaymentId: null,
    m_payment_id: 'race-regression-ref',
    pf_payment_id: null,
    recoveryToken: null,
    ...overrides,
  };
}

function reservedPosition(orderId: string, overrides: Record<string, unknown> = {}) {
  return {
    bookingRef: 'RACE-REGRESSION',
    showId: 'nationalShow',
    attendeeName: 'Race Regression',
    attendeeEmail: 'race-regression@saoc-check.invalid',
    ticketType: 'exhibitor',
    status: 'reserved',
    amount: 0,
    purchasedAt: null,
    checkedInAt: null,
    m_payment_id: 'race-regression-ref',
    pf_payment_id: null,
    orderId,
    compedBy: null,
    expiresAt: null,
    ...overrides,
  };
}

let failures = 0;

function fail(assertionId: string, message: string): void {
  failures += 1;
  console.error(`FAIL ${assertionId}: ${message}`);
}

function pass(assertionId: string, message: string): void {
  console.log(`PASS ${assertionId}: ${message}`);
}

// -------------------------------------------------------------------------------------------
// R2 — MUST be observed red first. orders.where() forced empty; document present by ref.
// Against today's (unfixed) code with no orderId supplied, the caller has no choice but to
// go through the where() query, so this reproduces 'order-not-found' deterministically. After
// the fix, the route (via lookup.orderId) supplies the id and the where() query is never
// consulted, so this commits.
// -------------------------------------------------------------------------------------------
async function runR2(): Promise<void> {
  const db = new FakeDb();
  const orderRef = db.orders.doc();
  db.orders.store.set(orderRef.id, reservedOrder());
  db.tickets.store.set('RACE-REGRESSION', reservedPosition(orderRef.id));
  db.orders.forceWhereEmpty = true; // the exact observed condition — index miss, doc present by ref

  const withoutOrderId = await markOrderAndPositionPaidByPaymentId(
    { m_payment_id: 'race-regression-ref', gatewayPaymentId: 'pf-1', now: Timestamp.now() },
    { db }
  );
  if (withoutOrderId.committed) {
    fail('R2', `expected order-not-found with no orderId + forced-empty where(), got committed=true`);
  } else if (withoutOrderId.reason !== 'order-not-found') {
    fail('R2', `expected reason 'order-not-found', got '${withoutOrderId.reason}'`);
  } else {
    pass('R2', "no orderId + forced-empty where() -> committed:false, reason:'order-not-found' (unfixed-code shape)");
  }

  const withOrderId = await markOrderAndPositionPaidByPaymentId(
    { m_payment_id: 'race-regression-ref', gatewayPaymentId: 'pf-1', now: Timestamp.now(), orderId: orderRef.id },
    { db }
  );
  if (!withOrderId.committed) {
    fail('R2', `expected commit when orderId supplied despite forced-empty where(), got reason='${withOrderId.reason}'`);
  } else {
    pass('R2', 'orderId supplied + forced-empty where() -> committed:true (fix bypasses the disagreeing index read)');
  }
}

// -------------------------------------------------------------------------------------------
// R1 — the redundant read cannot come back. When the caller supplies an order id, orders.where()
// must be called ZERO times and the ref read exactly once (via transaction.get, not observable
// as a call count here, so we assert on the where() counter, which is what the spec's "one index
// read per notification" property is actually about).
// -------------------------------------------------------------------------------------------
async function runR1(): Promise<void> {
  const db = new FakeDb();
  const orderRef = db.orders.doc();
  db.orders.store.set(orderRef.id, reservedOrder());
  db.tickets.store.set('RACE-REGRESSION', reservedPosition(orderRef.id));

  const outcome = await markOrderAndPositionPaidByPaymentId(
    { m_payment_id: 'race-regression-ref', gatewayPaymentId: 'pf-1', now: Timestamp.now(), orderId: orderRef.id },
    { db }
  );

  if (db.orders.whereCallCount !== 0) {
    fail('R1', `expected orders.where() called 0 times when orderId is supplied, got ${db.orders.whereCallCount}`);
  } else if (!outcome.committed) {
    fail('R1', `expected commit, got reason='${outcome.reason}'`);
  } else {
    pass('R1', 'orderId supplied -> orders.where() called 0 times, order+position committed');
  }
}

// -------------------------------------------------------------------------------------------
// R3 — the fixture fails loudly, not silently. waitUntilQueryable pointed at a stub whose
// queries never become non-empty must reject with a distinct PRECONDITION: message rather than
// resolving and letting the caller believe the fixture is ready.
// -------------------------------------------------------------------------------------------
async function runR3(): Promise<void> {
  const neverQueryable = {
    collection: () => ({
      where: () => ({
        limit: () => ({ get: async () => ({ empty: true }) }),
      }),
    }),
  };

  try {
    // Tiny bounds — this is a unit test, not a wait for real Firestore consistency.
    await waitUntilQueryable(neverQueryable, 'never-queryable-ref', 'never-queryable-order-id', 150, 25);
    fail('R3', 'expected waitUntilQueryable to throw on a stub that never becomes queryable, it resolved');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.startsWith('PRECONDITION:')) {
      fail('R3', `expected a message starting with 'PRECONDITION:', got: ${message}`);
    } else {
      pass('R3', 'stub that never becomes queryable -> throws PRECONDITION:-prefixed error, not a silent resolve');
    }
  }
}

// -------------------------------------------------------------------------------------------
// R4 — the two causes are distinguishable. Query miss (order-not-found) vs document deleted
// between ref-resolution and the transaction (order-vanished) must yield different reason
// values, proved via the returned outcome — not a grep for the string.
// -------------------------------------------------------------------------------------------
async function runR4(): Promise<void> {
  // Cause 1: query miss — no order ever existed for this reference.
  const queryMissDb = new FakeDb();
  const queryMissOutcome = await markOrderAndPositionPaidByPaymentId(
    { m_payment_id: 'no-such-reference', gatewayPaymentId: 'pf-1', now: Timestamp.now() },
    { db: queryMissDb }
  );

  // Cause 2: the caller resolved a real order id (e.g. from findReservedOrderByPaymentId), but
  // by the time the transaction re-reads it, the document is gone — order-vanished, not
  // order-not-found.
  const vanishedDb = new FakeDb();
  const vanishedOutcome = await markOrderAndPositionPaidByPaymentId(
    {
      m_payment_id: 'race-regression-ref',
      gatewayPaymentId: 'pf-1',
      now: Timestamp.now(),
      orderId: 'resolved-but-now-gone',
    },
    { db: vanishedDb }
  );

  if (queryMissOutcome.committed || queryMissOutcome.reason !== 'order-not-found') {
    fail('R4', `query-miss case: expected reason 'order-not-found', got ${JSON.stringify(queryMissOutcome)}`);
  } else if (vanishedOutcome.committed || vanishedOutcome.reason !== 'order-vanished') {
    fail('R4', `vanished case: expected reason 'order-vanished', got ${JSON.stringify(vanishedOutcome)}`);
  } else if (queryMissOutcome.reason === vanishedOutcome.reason) {
    fail('R4', 'both causes produced the same reason value');
  } else {
    pass(
      'R4',
      `query miss -> '${queryMissOutcome.reason}', vanished-mid-flight -> '${vanishedOutcome.reason}' (distinguishable)`
    );
  }
}

// -------------------------------------------------------------------------------------------
// R5 — the orderId-supplied path must revalidate identity inside the transaction. Codex
// GPT-5.5 cross-model review (2026-08-20) found that when the caller supplies orderId, the
// function resolves `orders.doc(orderId)` and never checks that the loaded order's
// `m_payment_id` matches `input.m_payment_id`. Query 2's removal (R1/R2 above) was justified
// as "redundant" per the spec, but the query was doing two jobs — locating the document AND
// validating it belonged to this notification's reference. We kept the first job (ref
// resolution, now via orderId) and dropped the second (identity) without replacing it.
//
// Scenario: orderId points at a REAL reserved order whose m_payment_id does NOT match the
// notification's m_payment_id (e.g. a stale/wrong orderId, or two notifications racing with
// swapped ids). Today, with no identity check, this commits and marks the WRONG order paid —
// that is the hole. After the fix, this must not commit, and must surface a reason distinct
// from the other four so an operator can tell "identity mismatch" apart from
// "order-not-found" / "order-vanished" / "order-not-reserved" / "position-not-found".
// -------------------------------------------------------------------------------------------
async function runR5(): Promise<void> {
  const db = new FakeDb();
  const orderRef = db.orders.doc();
  // The order that actually exists at orderRef belongs to a DIFFERENT m_payment_id than the
  // one this notification carries — e.g. a stale orderId reused against a fresher order.
  db.orders.store.set(orderRef.id, reservedOrder({ m_payment_id: 'the-real-owner-of-this-order' }));
  db.tickets.store.set(
    'RACE-REGRESSION-R5',
    reservedPosition(orderRef.id, { m_payment_id: 'the-real-owner-of-this-order', bookingRef: 'RACE-REGRESSION-R5' })
  );

  const outcome = await markOrderAndPositionPaidByPaymentId(
    {
      m_payment_id: 'a-different-notification-reference',
      gatewayPaymentId: 'pf-1',
      now: Timestamp.now(),
      orderId: orderRef.id,
    },
    { db }
  );

  const order = db.orders.store.get(orderRef.id);

  if (outcome.committed) {
    fail(
      'R5',
      `expected no commit when orderId's order.m_payment_id ('the-real-owner-of-this-order') !== ` +
        `input.m_payment_id ('a-different-notification-reference'), got committed=true (orderId=${outcome.orderId})`
    );
  } else if (order?.['status'] === 'paid') {
    fail('R5', `order was written 'paid' outside the reported outcome — mismatch identity check did not prevent the write`);
  } else if (outcome.reason === 'order-not-found' || outcome.reason === 'order-vanished' ||
             outcome.reason === 'order-not-reserved' || outcome.reason === 'position-not-found') {
    fail(
      'R5',
      `identity mismatch must surface a DISTINCT reason from the other four causes, got '${outcome.reason}' ` +
        `(a real orderId resolving to a real, still-reserved order is none of those four things)`
    );
  } else {
    pass('R5', `orderId resolves to an order whose m_payment_id disagrees with input.m_payment_id -> committed:false, reason:'${outcome.reason}' (distinct, order left untouched)`);
  }
}

async function main(): Promise<void> {
  await runR2();
  await runR1();
  await runR3();
  await runR4();
  await runR5();

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll orders-query-race regression assertions passed.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Unhandled error running orders-query-race regression suite:', error);
  process.exit(1);
});
