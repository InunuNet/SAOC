// Settlement flags: a payment that lands after the reservation hold lapsed settles exactly as an
// on-time one does (the paid transaction is untouched) and is flagged AFTER the commit, best
// effort and time-capped; the receipt outcome is recorded on the order by one capped write after
// the single send. Drives the REAL shared handler, lib/orders.ts, the real capacity loader and
// lib/receipt-record.ts against a stateful in-memory Firestore; only the gateway, the mailer, the
// Sanity client and the sold-count reads (which count their own calls) are fakes.
//
// Includes the QA repros of PR 229: a hanging CMS request (repro 1) and a throwing sold-count read
// (repro 3). The receipt outcome is one best-effort, 2 s-capped write after the single send; there
// is no automatic retry.
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
const mail = { deliveries: 0, sends: [] };
const behaviour = {
  mailFails: false,
  recordWrite: 'normal', // 'normal' | 'hang' | 'throw' (the receiptEmail status write)
  soldThrows: false,
  sanity: 'normal',
  capacity: 2,
  flagWriteFails: false,
};

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
        update: async (patch) => {
          if (patch.receiptEmail && behaviour.recordWrite === 'hang') return new Promise(() => {});
          if (patch.receiptEmail && behaviour.recordWrite === 'throw') throw new Error('write failed');
          applyUpdate(name, id, patch);
        },
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
};

mock.module('firebase-admin/firestore', {
  exports: { ...realFirestore, getFirestore: () => fakeDb },
});
mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => ({}) },
});
// The mailer is a plain fake: every send that does not throw is one delivery (no idempotency).
mock.module(new URL('../../../lib/confirmation-email.ts', import.meta.url).href, {
  exports: {
    sendConfirmationEmail: async (input) => {
      mail.sends.push(input);
      if (behaviour.mailFails) throw new Error('mailer down for buyer@saoc-check.invalid');
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
    // Same keying as lib/data/tickets.ts: a day-shaped type with a chosenDay is filed under
    // `${type}::${day}`, an undated one under its plain slug.
    getSoldCountsByTicketTypeAndDay: async (_showId, dayQualifiedTypes) => {
      const counts = {};
      for (const data of store.tickets.values()) {
        if (data.showId !== SHOW_ID || (data.status !== 'paid' && data.status !== 'reserved')) continue;
        const key =
          dayQualifiedTypes.has(data.ticketType) && data.chosenDay
            ? `${data.ticketType}::${data.chosenDay}`
            : data.ticketType;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    },
  },
});

const { POST } = await import('../../../lib/tickets-notification.ts');

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
  Object.assign(counters, { soldCountReads: 0, soldReadStatuses: [], sanityCalls: 0, sanityAborts: 0 });
  Object.assign(mail, { deliveries: 0, sends: [] });
  Object.assign(behaviour, {
    mailFails: false,
    recordWrite: 'normal',
    soldThrows: false,
    sanity: 'normal',
    capacity: 2,
    flagWriteFails: false,
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
  assert.equal('attempts' in order.receiptEmail, false, 'no attempts counter');
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

test('receipt failure is recorded as failed, with the error type only', async () => {
  behaviour.mailFails = true;
  seedOrder({ expiresAtMs: NOW_MS + HOUR_MS });
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid', 'a failed receipt never undoes the payment');
  assert.equal(order.receiptEmail.status, 'failed');
  assert.equal('attempts' in order.receiptEmail, false, 'no attempts counter');
  assert.equal(order.receiptEmail.lastErrorType, 'Error');
  assert.equal(JSON.stringify(order.receiptEmail).includes('buyer@'), false, 'raw error never stored');
});

test('receipt sent: records sent, with no error type', async () => {
  seedOrder({ expiresAtMs: NOW_MS + HOUR_MS });
  await POST(provider, request);
  const record = store.orders.get('order-1').receiptEmail;
  assert.equal(record.status, 'sent');
  assert.equal(record.lastErrorType, null);
  assert.ok(record.lastAttemptAt instanceof Timestamp);
  assert.deepEqual(Object.keys(record).sort(), ['lastAttemptAt', 'lastErrorType', 'status']);
});

test('the receipt send is made exactly once, with the unchanged arguments', async () => {
  seedOrder({ expiresAtMs: NOW_MS + HOUR_MS });
  await POST(provider, request);
  assert.equal(mail.sends.length, 1);
  assert.deepEqual(Object.keys(mail.sends[0]).sort(), [
    'amountPaid',
    'buyerEmail',
    'buyerName',
    'orderId',
    'orderReference',
    'paymentStatus',
    'positions',
    'recoveryToken',
  ]);
});

test('the record write hanging: 200 within the cap, and the late flag still runs', async () => {
  behaviour.recordWrite = 'hang';
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  const started = Date.now();
  const response = await POST(provider, request);
  const elapsed = Date.now() - started;
  assert.equal(response.status, 200);
  assert.ok(elapsed < 3500, `responded in ${elapsed} ms`);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal('receiptEmail' in order, false, 'the hung write recorded nothing');
  assert.equal(order.settlement.lateAfterHoldExpiry, true, 'the late flag still ran');
});

test('the record write throwing changes nothing else', async () => {
  behaviour.recordWrite = 'throw';
  seedOrder({ expiresAtMs: NOW_MS - HOUR_MS });
  const response = await POST(provider, request);
  assert.equal(response.status, 200);
  const order = store.orders.get('order-1');
  assert.equal(order.status, 'paid');
  assert.equal('receiptEmail' in order, false);
  assert.equal(order.settlement.lateAfterHoldExpiry, true);
  assert.equal(mail.deliveries, 1);
});

test('a duplicate notification writes no receipt record', async () => {
  seedOrder({ expiresAtMs: NOW_MS + HOUR_MS });
  await POST(provider, request);
  const record = store.orders.get('order-1').receiptEmail;
  const updates = store.updates;
  await POST(provider, request);
  assert.equal(store.updates, updates, 'no write at all');
  assert.equal(store.orders.get('order-1').receiptEmail, record);
  assert.equal(mail.sends.length, 1);
});

// Codex repro: a late multi-line order with an UNDATED day-shaped position plus a dated day ticket.
// The undated position is a legacy head against every per-day pool and must stay counted once.
const { flagLateSettlement } = await import('../../../lib/late-settlement-flag.ts');
const { DAY_VISITOR_SHAPED_SLUGS } = await import('../../../lib/provisional-figures.ts');

function legacyScenario(otherDatedSales) {
  const day = '2027-09-24';
  const shaped = DAY_VISITOR_SHAPED_SLUGS.find((slug) => slug !== 'day-visitor');
  store.orders.set('late-1', { status: 'paid', showId: SHOW_ID, m_payment_id: 'REF-late-1' });
  const own = (id, ticketType, chosenDay) =>
    store.tickets.set(id, {
      orderId: 'late-1',
      showId: SHOW_ID,
      status: 'paid',
      ticketType,
      ...(chosenDay ? { chosenDay } : {}),
    });
  own('own-undated', shaped, null);
  own('own-dated', 'day-visitor', day);
  for (let i = 0; i < otherDatedSales; i += 1) {
    store.tickets.set(`other-${i}`, {
      orderId: `o-${i}`,
      showId: SHOW_ID,
      status: 'paid',
      ticketType: 'day-visitor',
      chosenDay: day,
    });
  }
  const capacity = {
    capacityByType: { [shaped]: 100 },
    poolConfigByType: { [shaped]: { pool: null, headcountPerUnit: 1 } },
    dayCapRequestedQtyByType: { [`day-visitor::${day}`]: 1 },
    dayCapCapacityByType: { [`day-visitor::${day}`]: 3 },
    dayCapPoolConfigByType: Object.fromEntries(
      DAY_VISITOR_SHAPED_SLUGS.map((slug) => [
        `${slug}::${day}`,
        { pool: `day-visitor::${day}`, headcountPerUnit: 1 },
      ])
    ),
  };
  return {
    input: {
      orderId: 'late-1',
      reference: 'REF-late-1',
      positions: [
        { ticketType: shaped, chosenDay: null },
        { ticketType: 'day-visitor', chosenDay: day },
      ],
      expiresAt: Timestamp.fromMillis(NOW_MS - HOUR_MS),
      settledAt: Timestamp.fromMillis(NOW_MS),
    },
    deps: { loadCapacity: async () => capacity },
  };
}

test('legacy count: an undated day-shaped position of the order itself is counted once, not dropped', async () => {
  const { input, deps } = legacyScenario(2); // 2 dated + 1 legacy undated + this dated = 4 > 3
  await flagLateSettlement(input, deps);
  assert.equal(store.orders.get('late-1').settlement.overCapacity, true);
});

test('legacy count, control: one fewer dated sale is exactly at the cap, not over', async () => {
  const { input, deps } = legacyScenario(1); // 1 dated + 1 legacy + this dated = 3 <= 3
  await flagLateSettlement(input, deps);
  assert.equal(store.orders.get('late-1').settlement.overCapacity, false);
});
