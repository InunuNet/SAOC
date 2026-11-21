// Ticket-path hardening fix 3: findStrandedOrders only considers reservations that expired in
// the last 48 hours and asks Firestore for at most 50. Drives the REAL function against a fake
// store that evaluates the where/limit clauses it is given.
//
// Run as: npx tsx --test contracts/checks/ticket-path-hardening/check-reconcile-bounded.test.mjs

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Timestamp } from 'firebase-admin/firestore';

import {
  findStrandedOrders,
  STRANDED_CANDIDATE_CEILING,
  STRANDED_LOOKBACK_MS,
  STRANDED_PAGE_SIZE,
} from '../../../lib/reconciliation.ts';

const NOW = Timestamp.fromMillis(Date.UTC(2027, 0, 20, 12, 0, 0));
const HOUR_MS = 60 * 60 * 1000;

// Fake store that evaluates every clause it is given: where, orderBy, startAfter, limit.
function fakeDb(orders) {
  const seen = { limits: [] };
  const ms = (v) => (v instanceof Timestamp ? v.toMillis() : v);
  const query = (state) => ({
    where: (field, op, value) => query({ ...state, filters: [...state.filters, { field, op, value }] }),
    orderBy: (field, direction) => query({ ...state, order: { field, direction } }),
    startAfter: (snap) => query({ ...state, after: snap.id }),
    limit: (count) => {
      seen.limits.push(count);
      return query({ ...state, limit: count });
    },
    get: async () => {
      let rows = [...orders].filter(([, data]) =>
        state.filters.every(({ field, op, value }) => {
          if (op === '==') return ms(data[field]) === ms(value);
          if (op === '<') return ms(data[field]) < ms(value);
          return ms(data[field]) > ms(value);
        })
      );
      if (state.order) {
        const dir = state.order.direction === 'desc' ? -1 : 1;
        rows.sort((a, b) => dir * (ms(a[1][state.order.field]) - ms(b[1][state.order.field])));
      }
      if (state.after) rows = rows.slice(rows.findIndex(([id]) => id === state.after) + 1);
      if (state.limit !== undefined) rows = rows.slice(0, state.limit);
      return { empty: rows.length === 0, docs: rows.map(([id, data]) => ({ id, data: () => data })) };
    },
  });
  const root = query({ filters: [] });
  return { db: { collection: () => ({ ...root, doc: (id) => ({ id }) }), batch: () => ({}) }, seen };
}

const reservedExpired = (hoursAgo) => ({
  status: 'reserved',
  expiresAt: Timestamp.fromMillis(NOW.toMillis() - hoursAgo * HOUR_MS),
});

test('constants: 7 days, pages of 50, ceiling 500', () => {
  assert.equal(STRANDED_LOOKBACK_MS, 7 * 24 * HOUR_MS);
  assert.equal(STRANDED_PAGE_SIZE, 50);
  assert.equal(STRANDED_CANDIDATE_CEILING, 500);
});

test('reservations expired more than 7 days ago are ignored; 3 days ago is found', async () => {
  const { db } = fakeDb(
    new Map([
      ['recent', reservedExpired(2)],
      ['three-days', reservedExpired(72)],
      ['edge-inside', reservedExpired(167)],
      ['old', reservedExpired(169)],
      ['ancient', reservedExpired(24 * 30)],
    ])
  );
  const found = await findStrandedOrders(NOW, { db });
  assert.deepEqual(found.map((o) => o.orderId).sort(), ['edge-inside', 'recent', 'three-days']);
});

test('still-live reservations and paid orders are excluded as before', async () => {
  const { db } = fakeDb(
    new Map([
      ['live', reservedExpired(-1)],
      ['paid', { status: 'paid', expiresAt: reservedExpired(2).expiresAt }],
    ])
  );
  assert.deepEqual(await findStrandedOrders(NOW, { db }), []);
});

test('the 51st-newest order is found with 50 older carts present (pagination, newest first)', async () => {
  const orders = new Map();
  // 50 older abandoned carts inserted first, so an oldest-first limit(50) would return only them.
  for (let i = 0; i < 50; i++) orders.set(`old${i}`, reservedExpired(100 + i * 0.5));
  orders.set('fresh-paid-unsettled', reservedExpired(1));
  for (let i = 0; i < 49; i++) orders.set(`mid${i}`, reservedExpired(10 + i * 0.5));
  const { db, seen } = fakeDb(orders);
  const found = await findStrandedOrders(NOW, { db });
  assert.equal(found.length, 100);
  assert.equal(found[0].orderId, 'fresh-paid-unsettled', 'newest first');
  assert.ok(found.some((o) => o.orderId === 'old49'));
  assert.ok(seen.limits.every((n) => n <= STRANDED_PAGE_SIZE));
  assert.ok(seen.limits.length >= 3, 'more than one page was read');
});

test('the 51st-newest order specifically is returned (page 2 of newest-first)', async () => {
  const orders = new Map();
  for (let i = 0; i < 60; i++) orders.set(`n${i}`, reservedExpired(1 + i));
  const { db } = fakeDb(orders);
  const found = await findStrandedOrders(NOW, { db });
  assert.equal(found[50].orderId, 'n50');
});

test('hard ceiling: never more than 500 docs, newest kept, warning logged without PII', async () => {
  const orders = new Map();
  for (let i = 0; i < 600; i++) orders.set(`ord${i}`, reservedExpired(1 + i * 0.2));
  const { db } = fakeDb(orders);
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const found = await findStrandedOrders(NOW, { db });
    assert.equal(found.length, 500);
    assert.equal(found[0].orderId, 'ord0');
    assert.ok(!found.some((o) => o.orderId === 'ord599'), 'oldest cut');
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 1);
  assert.ok(!JSON.stringify(warnings).match(/ord\d/));
});

test('under the ceiling no warning is logged', async () => {
  const { db } = fakeDb(new Map([['a', reservedExpired(1)]]));
  const original = console.warn;
  let warned = false;
  console.warn = () => {
    warned = true;
  };
  try {
    await findStrandedOrders(NOW, { db });
  } finally {
    console.warn = original;
  }
  assert.equal(warned, false);
});
