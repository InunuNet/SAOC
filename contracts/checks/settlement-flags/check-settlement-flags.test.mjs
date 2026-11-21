// Settlement flags: a payment that lands after the reservation hold lapsed settles exactly as an
// on-time one does (the paid transaction is untouched) and is flagged AFTER the commit, best
// effort and time-capped; a failed receipt email is recorded on the order and retried by the
// reconcile run, boundedly and without ever re-sending a delivered receipt. Drives the REAL shared
// handler, lib/orders.ts, the real capacity loader, lib/ticket-receipt.ts and the reconcile route
// against a stateful in-memory Firestore; only the gateway, the mailers, the Sanity client and the
// sold-count reads (which count their own calls) are fakes.
//
// Includes the QA repros of PR 229: a hanging CMS request (repro 1), a throwing sold-count read
// (repro 3) and a delivered receipt whose 'sent' write fails (repro 4), now asserting the fix.
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
const RESPONSE_CAP_MS = 3500; // the 2 s assessment cap plus the 2 s write cap never stack in a hang

const store = { orders: new Map(), tickets: new Map(), updates: 0 };
const counters = { soldCountReads: 0, soldReadStatuses: [], sanityCalls: 0, sanityAborts: 0 };
const mail = { deliveries: 0, keys: new Set(), sends: [], alerts: 0 };
const events = [];
const behaviour = {
  mailFails: false,
  receiptIndexMissing: false,
  receiptQueryError: false,
  soldThrows: false,
  sanity: 'normal',
  capacity: 2,
  flagWriteFails: false,
  sentWriteFailsOnce: false,
};

const valueAt = (data, path) => path.split('.').reduce((value, key) => value?.[key], data);
const ms = (value) => (value instanceof Timestamp ? value.toMillis() : value);

function snapshot(collection, id) {
  const data = store[collection].get(id);
  return { id, exists: data !== undefined, data: () => data };
}

function applyUpdate(collection, id, patch) {
  if (behaviour.sentWriteFailsOnce && patch.receiptEmail?.status === 'sent') {
    behaviour.sentWriteFailsOnce = false;
    throw new Error('DEADLINE_EXCEEDED');
  }
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
      if (state.filters.some(({ field }) => field === 'receiptEmail.status')) {
        events.push('retry-query');
        if (behaviour.receiptQueryError) throw new Error('unavailable');
        if (behaviour.receiptIndexMissing) {
          throw Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
        }
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
      } else {
        rows.sort((a, b) => ms(a[1].expiresAt) - ms(b[1].expiresAt));
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
        get: async () => snapshot(name, id),
        update: async (patch) => applyUpdate(name, id, patch),
        set: async (patch) => {
          if (behaviour.flagWriteFails && patch.settlement) throw new Error('write failed');
          applyUpdate(name, id, patch);
        },
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
  batch: () => ({ update: () => {}, commit: async () => {} }),
};

mock.module('firebase-admin/firestore', {
  exports: { ...realFirestore, getFirestore: () => fakeDb },
});
mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => ({}) },
});
mock.module(new URL('../../../lib/email.ts', import.meta.url).href, {
  exports: {
    TICKETS_FROM_ADDRESS: 'tickets@saoc-check.invalid',
    sendEmail: async () => {
      events.push('alert');
      mail.alerts += 1;
    },
  },
});
// The mailer is a fake that behaves like Resend's idempotency key: a repeated key delivers once.
mock.module(new URL('../../../lib/confirmation-email.ts', import.meta.url).href, {
  exports: {
    sendConfirmationEmail: async (input) => {
      mail.sends.push(input);
      if (behaviour.mailFails) throw new Error('mailer down for buyer@saoc-check.invalid');
      if (input.idempotencyKey && mail.keys.has(input.idempotencyKey)) return;
      if (input.idempotencyKey) mail.keys.add(input.idempotencyKey);
      mail.deliveries += 1;
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
  exports: { sendTicketSaleAdminNotice: async () => {} },
});
mock.module(new URL('../../../lib/ticket-pdf-data.ts', import.meta.url).href, {
  exports: { loadChosenDays: async () => new Map() },
});
// The REAL capacity loader runs against this Sanity fake. 'hang' never settles unless aborted.
mock.module(new URL('../../../sanity/lib/client.ts', import.meta.url).href, {
  exports: {
    client: {
      fetch: (_query, _params, options) => {
        counters.sanityCalls += 1;
        if (behaviour.sanity === 'hang') {
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              counters.sanityAborts += 1;
              reject(new Error('aborted'));
            });
          });
        }
        return Promise.resolve({
          capacity: behaviour.capacity,
          releasedQuantity: null,
          requiresDaySelection: false,
          capacityPool: null,
          headcountPerUnit: 1,
        });
      },
    },
  },
});
// The same counting rule as lib/data/tickets.ts (reserved or paid, an expired reservation does not
// hold its seat), reading the fake store; records the order's status at the moment it is read.
mock.module(new URL('../../../lib/data/tickets.ts', import.meta.url).href, {
  exports: {
    getSoldCountsByTicketType: async () => {
      counters.soldCountReads += 1;
      counters.soldReadStatuses.push(store.orders.get('order-1')?.status);
      if (behaviour.soldThrows) throw new Error('read failed');
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

let warnings;
beforeEach(() => {
  mock.restoreAll();
  store.orders.clear();
  store.tickets.clear();
  store.updates = 0;
  events.length = 0;
  Object.assign(counters, { soldCountReads: 0, soldReadStatuses: [], sanityCalls: 0, sanityAborts: 0 });
  Object.assign(mail, { deliveries: 0, keys: new Set(), sends: [], alerts: 0 });
  Object.assign(behaviour, {
    mailFails: false,
    receiptIndexMissing: false,
    receiptQueryError: false,
    soldThrows: false,
    sanity: 'normal',
    capacity: 2,
    flagWriteFails: false,
    sentWriteFailsOnce: false,
  });
  warnings = mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {});
});

test('on-time payment: no late flag, no CMS call, no sold-count read, no warning', async () => {
  seedOrder({ expiresAtMs: NOW_MS + HOUR_MS });
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal('settlement' in order, false);
  assert.equal(counters.sanityCalls, 0);
  assert.equal(counters.soldCountReads, 0);
  assert.equal(warnings.mock.calls.length, 0);
  assert.equal(order.receiptEmail.status, 'sent');
  assert.equal(order.receiptEmail.attempts, 1);
  assert.equal(order.receiptEmail.lastErrorType, null);
});

test('late payment with capacity left: settles, then flags late only, after the commit', async () => {
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
  assert.deepEqual(counters.soldReadStatuses, ['paid'], 'sold counts are read only after the order is paid');
  assert.equal(mail.deliveries, 1, 'the receipt is still sent');
  assert.equal(store.orders.get('order-1').receiptEmail.status, 'sent');
});

test('late payment over capacity: still settles and issues the ticket, flags both, no PII logged', async () => {
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  seedOtherPaid(2);
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal(store.tickets.get('pos-1').status, 'paid');
  assert.equal(order.settlement.lateAfterHoldExpiry, true);
  assert.equal(order.settlement.overCapacity, true);
  assert.equal(mail.deliveries, 1);
  const logged = JSON.stringify(warnings.mock.calls.map((call) => call.arguments));
  assert.ok(logged.includes(REFERENCE) && logged.includes('general-admission'));
  assert.equal(logged.includes('buyer@') || logged.includes('"Buyer"'), false);
  assert.equal(Object.values(order).some((value) => value === undefined), false, 'no undefined writes');
});

test('QA repro 1: a CMS request that never resolves cannot delay or block settlement', async () => {
  behaviour.sanity = 'hang';
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  const started = Date.now();
  const response = await POST(provider, request);
  const elapsed = Date.now() - started;
  assert.equal(response.status, 200);
  assert.ok(elapsed < RESPONSE_CAP_MS, `responded in ${elapsed} ms`);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal(order.settlement.lateAfterHoldExpiry, true);
  assert.equal(order.settlement.overCapacity, null, 'unverified when the CMS did not answer');
  assert.ok(counters.sanityAborts >= 1, 'the CMS request was aborted');
  assert.equal(mail.deliveries, 1, 'the receipt went out before the flag was attempted');
});

test('QA repro 3: a throwing sold-count read still gives 200, a settled order and an unverified flag', async () => {
  behaviour.soldThrows = true;
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal(store.tickets.get('pos-1').status, 'paid');
  assert.equal(order.settlement.overCapacity, null);
  assert.equal(mail.deliveries, 1);
});

test('a failing flag write changes nothing else: 200, settled, receipt sent, warning only', async () => {
  behaviour.flagWriteFails = true;
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal('settlement' in order, false);
  assert.equal(mail.deliveries, 1);
  assert.ok(warnings.mock.calls.length >= 1);
});

test('duplicate notification neither recomputes nor rewrites the flag, nor re-sends the receipt', async () => {
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  await POST(provider, request);
  const flag = store.orders.get('order-1').settlement;
  const before = {
    sanityCalls: counters.sanityCalls,
    soldReads: counters.soldCountReads,
    updates: store.updates,
    deliveries: mail.deliveries,
  };
  const duplicate = await POST(provider, request);
  assert.equal(duplicate.status, 200);
  assert.equal(counters.sanityCalls, before.sanityCalls, 'no CMS call');
  assert.equal(counters.soldCountReads, before.soldReads, 'no sold-count read');
  assert.equal(store.updates, before.updates, 'no write at all');
  assert.equal(mail.deliveries, before.deliveries);
  assert.equal(store.orders.get('order-1').settlement, flag, 'the flag object is untouched');
});

test('receipt failure is recorded as failed, with the error type only; the first send carries a stable key', async () => {
  behaviour.mailFails = true;
  seedOrder({ expiresAtMs: NOW_MS + HOUR_MS });
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid', 'a failed receipt never undoes the payment');
  assert.equal(order.receiptEmail.status, 'failed');
  assert.equal(order.receiptEmail.attempts, 1);
  assert.equal(order.receiptEmail.lastErrorType, 'Error');
  assert.equal(JSON.stringify(order.receiptEmail).includes('buyer@'), false, 'raw error never stored');
  assert.equal(mail.sends[0].idempotencyKey, 'receipt-order-1');
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
  const first = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.equal(first.resent, 1);
  assert.equal(mail.deliveries, 1);
  const record = store.orders.get('o1').receiptEmail;
  assert.equal(record.status, 'sent');
  assert.equal(record.attempts, 2);
  assert.equal(record.lastErrorType, null);

  const second = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS + HOUR_MS));
  assert.equal(second.resent, 0);
  assert.equal(mail.sends.length, 1, 'no second send at all');
});

test('QA repro 4: delivered receipt whose sent-write fails is not delivered again on the next run', async () => {
  seedPaidOrder('o1', failedRecord(1));
  behaviour.sentWriteFailsOnce = true;
  await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.equal(mail.deliveries, 1);
  assert.equal(store.orders.get('o1').receiptEmail.status, 'failed', 'the sent write was lost');
  await retryFailedReceipts(Timestamp.fromMillis(NOW_MS + HOUR_MS));
  assert.equal(mail.sends.length, 2, 'the retry re-sent');
  assert.equal(mail.sends[0].idempotencyKey, mail.sends[1].idempotencyKey, 'with the same stable key');
  assert.equal(mail.deliveries, 1, 'so the buyer received one receipt');
  assert.equal(store.orders.get('o1').receiptEmail.status, 'sent');
});

test('attempts cap at 3 in total, then the order is left alone', async () => {
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
  assert.equal(mail.sends.length, 2, 'attempts 2 and 3 only; run 4 sends nothing');
});

test('a sent order, a pre-field order and an old failure are never sent', async () => {
  seedPaidOrder('sent', { ...failedRecord(1), status: 'sent', lastErrorType: null });
  seedPaidOrder('legacy', null);
  seedPaidOrder('old', failedRecord(1), NOW_MS - 8 * 24 * HOUR_MS);
  const summary = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.equal(summary.resent, 0);
  assert.equal(mail.sends.length, 0);
  assert.equal(store.orders.get('sent').receiptEmail.attempts, 1, 'sent order untouched');
});

test('a retry attempted a moment ago is not repeated (overlapping runs)', async () => {
  seedPaidOrder('o1', failedRecord(1, NOW_MS - 60_000));
  const summary = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.equal(summary.resent, 0);
  assert.equal(mail.sends.length, 0);
});

test('at most 20 receipts are resent per run', async () => {
  for (let i = 0; i < 25; i += 1) seedPaidOrder(`bulk-${i}`, failedRecord(1));
  const summary = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.equal(summary.resent, 20);
  assert.equal(mail.deliveries, 20);
});

test('time budget: no new send starts once it is spent; the rest is reported as deferred', async () => {
  for (let i = 0; i < 5; i += 1) seedPaidOrder(`slow-${i}`, failedRecord(1));
  let clock = 0;
  const summary = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS), {
    budgetMs: 25_000,
    clock: () => {
      clock += 10_000; // every look at the clock costs 10 s
      return clock;
    },
  });
  assert.equal(summary.resent + summary.stillFailing + summary.deferred, summary.scanned);
  assert.ok(summary.deferred >= 1, `deferred ${summary.deferred}`);
  assert.equal(mail.sends.length, summary.resent + summary.stillFailing);
});

function reconcileRequest() {
  process.env.RECONCILIATION_CRON_SECRET = 'check-secret';
  return { headers: new Headers({ authorization: 'Bearer check-secret' }) };
}

function seedStrandedOrder() {
  store.orders.set('stranded', {
    status: 'reserved',
    m_payment_id: 'REF-stranded',
    buyerName: 'Buyer',
    buyerEmail: BUYER_EMAIL,
    amount: 10,
    expiresAt: Timestamp.fromMillis(NOW_MS - 2 * HOUR_MS),
  });
}

test('missing index: the retry skips softly and the reconcile run carries on', async () => {
  behaviour.receiptIndexMissing = true;
  seedPaidOrder('o1', failedRecord(1));
  const summary = await retryFailedReceipts(Timestamp.fromMillis(NOW_MS));
  assert.deepEqual(summary, { scanned: 0, resent: 0, stillFailing: 0, deferred: 0, skipped: 'missing-index' });
  assert.equal(mail.sends.length, 0);

  const response = await reconcileRoute.POST(reconcileRequest());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.strandedCount, 0);
  assert.equal(body.receiptRetry.skipped, 'missing-index');
});

test('reconcile: the stranded-order alert is sent first and survives a throwing retry', async () => {
  behaviour.receiptQueryError = true;
  seedStrandedOrder();
  const response = await reconcileRoute.POST(reconcileRequest());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.alertedNow, ['stranded']);
  assert.equal(mail.alerts, 1, 'the alert went out');
  assert.equal(body.receiptRetry, null, 'the failed retry is reported as null, not thrown');
  assert.deepEqual(events.filter((event) => event === 'alert' || event === 'retry-query'), ['alert', 'retry-query']);
});

test('reconcile: the alert is not held up by failed receipts waiting for retry', async () => {
  seedStrandedOrder();
  seedPaidOrder('o1', failedRecord(1));
  const response = await reconcileRoute.POST(reconcileRequest());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.alertedNow, ['stranded']);
  assert.equal(body.receiptRetry.resent, 1);
  assert.ok(events.indexOf('alert') < events.indexOf('retry-query'), 'alert first, retry after');
});
