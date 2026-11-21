// Settlement flags: a payment that lands after the reservation hold lapsed still settles, and is
// flagged when capacity was oversold; a failed receipt email is recorded on the order and retried
// by the reconcile run, boundedly and without ever re-sending a delivered receipt. Drives the REAL
// shared handler, lib/orders.ts, lib/ticket-receipt.ts and the reconcile route against a stateful
// in-memory Firestore; only the gateway, the mailers, the CMS capacity loader and the sold-count
// reads (which count their own calls) are fakes.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/settlement-flags/check-settlement-flags.test.mjs

import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

const realFirestore = await import('firebase-admin/firestore');
const { Timestamp } = realFirestore;

const HOUR_MS = 60 * 60 * 1000;
const NOW_MS = Date.now();
const SHOW_ID = 'show-1';

const store = { orders: new Map(), tickets: new Map(), updates: 0 };
const counters = { soldCountReads: 0, capacityLoads: 0, receipts: 0, adminNotices: 0 };
const behaviour = { mailFails: false, receiptIndexMissing: false, capacity: null };

const valueAt = (data, path) => path.split('.').reduce((value, key) => value?.[key], data);
const ms = (value) => (value instanceof Timestamp ? value.toMillis() : value);

function snapshot(collection, id) {
  const data = store[collection].get(id);
  return { id, exists: data !== undefined, data: () => data };
}

function applyUpdate(collection, id, patch) {
  store[collection].set(id, { ...store[collection].get(id), ...patch });
  store.updates += 1;
}

function query(name, state = { filters: [] }) {
  return {
    where: (field, op, value) => query(name, { ...state, filters: [...state.filters, { field, op, value }] }),
    orderBy: (field, direction) => query(name, { ...state, order: { field, direction } }),
    startAfter: (snap) => query(name, { ...state, after: snap.id }),
    limit: (count) => query(name, { ...state, limit: count }),
    get: async () => {
      if (
        behaviour.receiptIndexMissing &&
        state.filters.some(({ field }) => field === 'receiptEmail.status')
      ) {
        throw Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
      }
      let rows = [...store[name].entries()].filter(([, data]) =>
        state.filters.every(({ field, op, value }) => {
          const actual = ms(valueAt(data, field));
          if (op === '==') return actual === ms(value);
          if (op === '<') return actual < ms(value);
          return actual > ms(value);
        })
      );
      if (state.order) {
        const dir = state.order.direction === 'desc' ? -1 : 1;
        rows.sort((a, b) => dir * (ms(valueAt(a[1], state.order.field)) - ms(valueAt(b[1], state.order.field))));
      }
      if (state.after) rows = rows.slice(rows.findIndex(([id]) => id === state.after) + 1);
      if (state.limit !== undefined) rows = rows.slice(0, state.limit);
      return { empty: rows.length === 0, docs: rows.map(([id]) => snapshot(name, id)) };
    },
  };
}

const fakeDb = {
  collection(name) {
    return {
      ...query(name),
      doc: (id) => ({
        id,
        __collection: name,
        update: async (patch) => applyUpdate(name, id, patch),
      }),
    };
  },
  async runTransaction(fn) {
    const staged = [];
    const transaction = {
      get: async (ref) => snapshot(ref.__collection, ref.id),
      update: (ref, patch) => staged.push({ ref, patch }),
    };
    const result = await fn(transaction);
    for (const { ref, patch } of staged) applyUpdate(ref.__collection, ref.id, patch);
    return result;
  },
  batch: () => ({}),
};

mock.module('firebase-admin/firestore', {
  exports: { ...realFirestore, getFirestore: () => fakeDb },
});
mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => ({}) },
});
mock.module(new URL('../../../lib/confirmation-email.ts', import.meta.url).href, {
  exports: {
    sendConfirmationEmail: async () => {
      if (behaviour.mailFails) throw new Error('mailer down for buyer@saoc-check.invalid');
      counters.receipts += 1;
    },
    deliverConfirmationEmailAfterCommit: async (send, onError) => {
      try {
        await send();
      } catch (error) {
        onError(error);
      }
    },
  },
});
mock.module(new URL('../../../lib/ticket-sale-admin-notice.ts', import.meta.url).href, {
  exports: {
    sendTicketSaleAdminNotice: async () => {
      counters.adminNotices += 1;
    },
  },
});
mock.module(new URL('../../../lib/ticket-pdf-data.ts', import.meta.url).href, {
  exports: { loadChosenDays: async () => new Map() },
});
mock.module(new URL('../../../lib/late-settlement-capacity.ts', import.meta.url).href, {
  exports: {
    loadLateSettlementCapacity: async () => {
      counters.capacityLoads += 1;
      return behaviour.capacity;
    },
  },
});
// The same counting rule as lib/data/tickets.ts (reserved or paid, an expired reservation does not
// hold its seat), reading the fake store and counting how often it is asked.
mock.module(new URL('../../../lib/data/tickets.ts', import.meta.url).href, {
  exports: {
    getSoldCountsByTicketType: async () => {
      counters.soldCountReads += 1;
      const counts = {};
      for (const data of store.tickets.values()) {
        if (data.showId !== SHOW_ID) continue;
        const holds =
          data.status === 'paid' ||
          (data.status === 'reserved' && !(data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() <= NOW_MS));
        if (holds) counts[data.ticketType] = (counts[data.ticketType] ?? 0) + 1;
      }
      return counts;
    },
    getSoldCountsByTicketTypeAndDay: async () => ({}),
  },
});

const { POST } = await import('../../../lib/tickets-notification.ts');
const { retryFailedReceipts, RECEIPT_MAX_ATTEMPTS } = await import('../../../lib/ticket-receipt.ts');
const reconcileRoute = await import('../../../app/api/admin/reconcile-orders/route.ts');

const REFERENCE = 'SAOC-2027-LATEPAY0001';
const BUYER_EMAIL = 'buyer@saoc-check.invalid';
const CAPACITY = {
  capacityByType: { 'general-admission': 2 },
  poolConfigByType: { 'general-admission': { pool: null, headcountPerUnit: 1 } },
  dayCapRequestedQtyByType: {},
  dayCapCapacityByType: {},
  dayCapPoolConfigByType: {},
};

function seedOrder({ expiresAtMs }) {
  store.orders.set('order-1', {
    status: 'reserved',
    showId: SHOW_ID,
    m_payment_id: REFERENCE,
    gateway: 'ozow',
    amount: 10,
    expectedGatewayAmount: null,
    buyerEmail: BUYER_EMAIL,
    buyerName: 'Buyer',
    recoveryToken: null,
    expiresAt: Timestamp.fromMillis(expiresAtMs),
  });
  store.tickets.set('pos-1', {
    bookingRef: 'pos-1',
    orderId: 'order-1',
    showId: SHOW_ID,
    status: 'reserved',
    attendeeName: 'Buyer',
    ticketType: 'general-admission',
    expiresAt: Timestamp.fromMillis(expiresAtMs),
  });
}

function seedOtherPaid(count) {
  for (let i = 0; i < count; i += 1) {
    store.tickets.set(`other-${i}`, {
      orderId: `other-order-${i}`,
      showId: SHOW_ID,
      status: 'paid',
      ticketType: 'general-admission',
    });
  }
}

const provider = {
  id: 'ozow',
  verifyNotification: async () => ({
    verified: true,
    notification: {
      reference: REFERENCE,
      rawStatus: 'Complete',
      grossAmount: '10.00',
      grossAmountCents: 1000,
      gatewayPaymentId: 'tx-1',
      sourceIp: null,
      sourceIpTrusted: true,
      raw: {},
    },
  }),
  mapStatus: () => 'paid',
  confirmNotification: async () => ({ confirmed: true }),
};
const request = { text: async () => 'body', headers: new Headers() };

beforeEach(() => {
  store.orders.clear();
  store.tickets.clear();
  store.updates = 0;
  Object.assign(counters, { soldCountReads: 0, capacityLoads: 0, receipts: 0, adminNotices: 0 });
  Object.assign(behaviour, { mailFails: false, receiptIndexMissing: false, capacity: CAPACITY });
});

function captureWarnings() {
  const warnings = mock.method(console, 'warn', () => {});
  return warnings;
}

test('on-time payment: no late flag and no extra reads', async () => {
  const warnings = captureWarnings();
  seedOrder({ expiresAtMs: NOW_MS + HOUR_MS });
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal('settlement' in order, false, 'no settlement field on an on-time order');
  assert.equal(counters.capacityLoads, 0, 'no capacity lookup');
  assert.equal(counters.soldCountReads, 0, 'no sold-count reads');
  assert.equal(warnings.mock.calls.length, 0);
  assert.equal(order.receiptEmail.status, 'sent');
  assert.equal(order.receiptEmail.attempts, 1);
  assert.equal(order.receiptEmail.lastErrorType, null);
  warnings.mock.restore();
});

test('late payment with capacity left: settles, flags late only', async () => {
  const warnings = captureWarnings();
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  seedOtherPaid(1);
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal(store.tickets.get('pos-1').status, 'paid');
  assert.equal(order.settlement.lateAfterHoldExpiry, true);
  assert.equal(order.settlement.overCapacity, false);
  assert.ok(order.settlement.detectedAt instanceof Timestamp);
  assert.equal(counters.receipts, 1, 'the receipt is still sent');
  assert.equal(warnings.mock.calls.length, 1, 'one structured warning');
  warnings.mock.restore();
});

test('late payment over capacity: still settles and issues the ticket, flags both', async () => {
  const warnings = captureWarnings();
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  seedOtherPaid(2);
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid', 'the buyer has paid, so the order settles');
  assert.equal(store.tickets.get('pos-1').status, 'paid', 'the ticket is issued');
  assert.equal(order.settlement.lateAfterHoldExpiry, true);
  assert.equal(order.settlement.overCapacity, true);
  assert.equal(counters.receipts, 1);
  assert.equal(warnings.mock.calls.length, 1);
  const logged = JSON.stringify(warnings.mock.calls[0].arguments);
  assert.ok(logged.includes(REFERENCE) && logged.includes('general-admission'));
  assert.equal(logged.includes('buyer@'), false, 'no buyer email in the log line');
  assert.equal(logged.includes('"Buyer"'), false, 'no buyer name in the log line');
  assert.equal(Object.values(order).some((value) => value === undefined), false, 'no undefined writes');
  warnings.mock.restore();
});

test('late payment whose capacity cannot be loaded: settles, overCapacity unverified', async () => {
  const warnings = captureWarnings();
  behaviour.capacity = null;
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  await POST(provider, request);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal(order.settlement.lateAfterHoldExpiry, true);
  assert.equal(order.settlement.overCapacity, null);
  warnings.mock.restore();
});

test('receipt failure is recorded as failed, with the error type only', async () => {
  const errors = mock.method(console, 'error', () => {});
  behaviour.mailFails = true;
  seedOrder({ expiresAtMs: NOW_MS + HOUR_MS });
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid', 'a failed receipt never undoes the payment');
  assert.equal(order.receiptEmail.status, 'failed');
  assert.equal(order.receiptEmail.attempts, 1);
  assert.equal(order.receiptEmail.lastErrorType, 'Error');
  assert.ok(order.receiptEmail.lastAttemptAt instanceof Timestamp);
  assert.equal(JSON.stringify(order.receiptEmail).includes('buyer@'), false, 'raw error never stored');
  errors.mock.restore();
});

function seedPaidOrder(id, receiptEmail, purchasedAtMs = NOW_MS - 2 * HOUR_MS) {
  store.orders.set(id, {
    status: 'paid',
    showId: SHOW_ID,
    m_payment_id: `REF-${id}`,
    amount: 10,
    buyerEmail: BUYER_EMAIL,
    buyerName: 'Buyer',
    recoveryToken: null,
    purchasedAt: Timestamp.fromMillis(purchasedAtMs),
    ...(receiptEmail ? { receiptEmail } : {}),
  });
  store.tickets.set(`pos-${id}`, {
    bookingRef: `pos-${id}`,
    orderId: id,
    status: 'paid',
    attendeeName: 'Buyer',
    ticketType: 'general-admission',
  });
}

const failedRecord = (attempts, lastAttemptMs = NOW_MS - 2 * HOUR_MS) => ({
  status: 'failed',
  attempts,
  lastAttemptAt: Timestamp.fromMillis(lastAttemptMs),
  lastErrorType: 'Error',
});

test('reconcile retry resends once and marks sent; a second run sends nothing', async () => {
  seedPaidOrder('o1', failedRecord(1));
  const now = Timestamp.fromMillis(NOW_MS);
  const first = await retryFailedReceipts(now);
  assert.equal(first.resent, 1);
  assert.equal(counters.receipts, 1);
  const record = store.orders.get('o1').receiptEmail;
  assert.equal(record.status, 'sent');
  assert.equal(record.attempts, 2);
  assert.equal(record.lastErrorType, null);

  const second = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS + HOUR_MS));
  assert.equal(second.resent, 0);
  assert.equal(counters.receipts, 1, 'no second receipt');
});

test('attempts cap at 3 in total, then the order is left alone', async () => {
  const errors = mock.method(console, 'error', () => {});
  behaviour.mailFails = true;
  seedPaidOrder('o1', failedRecord(1));
  let clock = NOW_MS;
  for (let run = 0; run < 4; run += 1) {
    await retryFailedReceipts(Timestamp.fromMillis(clock));
    clock += HOUR_MS;
  }
  const record = store.orders.get('o1').receiptEmail;
  assert.equal(record.status, 'failed');
  assert.equal(record.attempts, RECEIPT_MAX_ATTEMPTS, 'stops at the cap');
  behaviour.mailFails = false;
  await retryFailedReceipts(Timestamp.fromMillis(clock));
  assert.equal(counters.receipts, 0, 'a capped order is never sent again');
  errors.mock.restore();
});

test('a sent order, a pre-field order and an old failure are never sent', async () => {
  seedPaidOrder('sent', { ...failedRecord(1), status: 'sent', lastErrorType: null });
  seedPaidOrder('legacy', null);
  seedPaidOrder('old', failedRecord(1), NOW_MS - 8 * 24 * HOUR_MS);
  const summary = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.equal(summary.resent, 0);
  assert.equal(counters.receipts, 0);
  assert.equal(store.orders.get('sent').receiptEmail.attempts, 1, 'sent order untouched');
});

test('a retry attempted a moment ago is not repeated (overlapping runs)', async () => {
  seedPaidOrder('o1', failedRecord(1, NOW_MS - 60_000));
  const summary = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.equal(summary.resent, 0);
  assert.equal(counters.receipts, 0);
});

test('at most 20 receipts are resent per run', async () => {
  for (let i = 0; i < 25; i += 1) seedPaidOrder(`bulk-${i}`, failedRecord(1));
  const summary = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.equal(summary.resent, 20);
  assert.equal(counters.receipts, 20);
});

test('missing index: retry skips softly and the reconcile run carries on', async () => {
  const warnings = captureWarnings();
  behaviour.receiptIndexMissing = true;
  seedPaidOrder('o1', failedRecord(1));
  const summary = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.deepEqual(summary, { scanned: 0, resent: 0, stillFailing: 0, skipped: 'missing-index' });
  assert.equal(counters.receipts, 0);

  process.env.RECONCILIATION_CRON_SECRET = 'check-secret';
  const response = await reconcileRoute.POST({
    headers: new Headers({ authorization: 'Bearer check-secret' }),
  });
  assert.equal(response.status, 200, 'the rest of the run is unaffected');
  const body = await response.json();
  assert.equal(body.strandedCount, 0);
  assert.equal(body.receiptRetry.skipped, 'missing-index');
  warnings.mock.restore();
});
