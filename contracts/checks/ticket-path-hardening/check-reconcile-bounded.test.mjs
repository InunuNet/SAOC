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
  STRANDED_CANDIDATE_LIMIT,
  STRANDED_LOOKBACK_MS,
} from '../../../lib/reconciliation.ts';

const NOW = Timestamp.fromMillis(Date.UTC(2027, 0, 10, 12, 0, 0));
const HOUR_MS = 60 * 60 * 1000;

function fakeDb(orders) {
  const seen = { limit: null };
  const query = (filters) => ({
    where: (field, op, value) => query([...filters, { field, op, value }]),
    limit: (count) => {
      seen.limit = count;
      return query(filters);
    },
    get: async () => {
      const rows = [...orders].filter(([, data]) =>
        filters.every(({ field, op, value }) => {
          const v = data[field];
          const cmp = v instanceof Timestamp ? v.toMillis() : v;
          const target = value instanceof Timestamp ? value.toMillis() : value;
          if (op === '==') return cmp === target;
          if (op === '<') return cmp < target;
          return cmp > target;
        })
      );
      const capped = seen.limit === null ? rows : rows.slice(0, seen.limit);
      return { empty: capped.length === 0, docs: capped.map(([id, data]) => ({ id, data: () => data })) };
    },
  });
  return { db: { collection: () => ({ ...query([]), doc: (id) => ({ id }) }), batch: () => ({}) }, seen };
}

const reservedExpired = (hoursAgo) => ({
  status: 'reserved',
  expiresAt: Timestamp.fromMillis(NOW.toMillis() - hoursAgo * HOUR_MS),
});

test('constants are 48 hours and 50 rows', () => {
  assert.equal(STRANDED_LOOKBACK_MS, 48 * HOUR_MS);
  assert.equal(STRANDED_CANDIDATE_LIMIT, 50);
});

test('reservations expired more than 48h ago are ignored', async () => {
  const { db } = fakeDb(
    new Map([
      ['recent', reservedExpired(2)],
      ['edge-inside', reservedExpired(47)],
      ['old', reservedExpired(49)],
      ['ancient', reservedExpired(24 * 30)],
    ])
  );
  const found = await findStrandedOrders(NOW, { db });
  assert.deepEqual(found.map((o) => o.orderId).sort(), ['edge-inside', 'recent']);
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

test('the query is limited to 50 candidates', async () => {
  const orders = new Map();
  for (let i = 0; i < 80; i++) orders.set(`o${i}`, reservedExpired(3));
  const { db, seen } = fakeDb(orders);
  const found = await findStrandedOrders(NOW, { db });
  assert.equal(seen.limit, 50);
  assert.equal(found.length, 50);
});
