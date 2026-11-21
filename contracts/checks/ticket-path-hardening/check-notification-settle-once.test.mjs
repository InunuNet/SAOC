// Ticket-path hardening: a notification retried after a 503 settles the order exactly once,
// and a plain duplicate delivery neither settles twice nor sends a second email. Drives the REAL
// shared handler and the REAL lib/orders.ts against a stateful in-memory Firestore; only the
// gateway provider and the two mailers are fakes.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/ticket-path-hardening/check-notification-settle-once.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const realFirestore = await import('firebase-admin/firestore');

const store = {
  orders: new Map(),
  tickets: new Map(),
  updates: 0,
};

function snapshot(collection, id) {
  const data = store[collection].get(id);
  return { id, exists: data !== undefined, data: () => data };
}

const fakeDb = {
  collection(name) {
    return {
      doc: (id) => ({ id, __collection: name }),
      where: (field, op, value) => {
        const rows = () =>
          [...store[name].entries()]
            .filter(([, data]) => data[field] === value)
            .map(([id]) => snapshot(name, id));
        const result = () => ({ empty: rows().length === 0, docs: rows() });
        return { limit: () => ({ get: async () => result() }), get: async () => result() };
      },
    };
  },
  async runTransaction(fn) {
    const staged = [];
    const transaction = {
      get: async (ref) => snapshot(ref.__collection, ref.id),
      update: (ref, patch) => staged.push({ ref, patch }),
    };
    const result = await fn(transaction);
    for (const { ref, patch } of staged) {
      store[ref.__collection].set(ref.id, { ...store[ref.__collection].get(ref.id), ...patch });
      store.updates += 1;
    }
    return result;
  },
};

mock.module('firebase-admin/firestore', {
  exports: { ...realFirestore, getFirestore: () => fakeDb },
});
mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => ({}) },
});

const mail = { receipts: 0, adminNotices: 0 };
mock.module(new URL('../../../lib/confirmation-email.ts', import.meta.url).href, {
  exports: {
    sendConfirmationEmail: async () => {
      mail.receipts += 1;
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
      mail.adminNotices += 1;
    },
  },
});
mock.module(new URL('../../../lib/ticket-pdf-data.ts', import.meta.url).href, {
  exports: { loadChosenDays: async () => new Map() },
});

const { POST } = await import('../../../lib/tickets-notification.ts');

const REFERENCE = 'SAOC-2027-SETTLEONCE1';
store.orders.set('order-1', {
  status: 'reserved',
  m_payment_id: REFERENCE,
  gateway: 'ozow',
  amount: 10,
  expectedGatewayAmount: null,
  buyerEmail: 'buyer@saoc-check.invalid',
  buyerName: 'Buyer',
  recoveryToken: null,
});
store.tickets.set('pos-1', {
  bookingRef: 'pos-1',
  orderId: 'order-1',
  status: 'reserved',
  attendeeName: 'Buyer',
  ticketType: 'general-admission',
});

let confirmResult = { confirmed: true };
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
  confirmNotification: async () => confirmResult,
};
const request = { text: async () => 'body', headers: new Headers() };

test('503 then success then duplicate: settles once, one receipt, one admin notice', async () => {
  confirmResult = { confirmed: false, reason: 'request-failed' };
  const first = await POST(provider, request);
  assert.equal(first.status, 503);
  assert.equal(store.orders.get('order-1').status, 'reserved', 'a 503 settles nothing');
  assert.equal(store.updates, 0);
  assert.equal(mail.receipts, 0);

  confirmResult = { confirmed: true };
  const retry = await POST(provider, request);
  assert.equal(retry.status, 200);
  assert.equal(store.orders.get('order-1').status, 'paid');
  assert.equal(store.tickets.get('pos-1').status, 'paid');
  assert.equal(store.updates, 2, 'order and its one position written once each');
  assert.equal(mail.receipts, 1);
  assert.equal(mail.adminNotices, 1);

  const duplicate = await POST(provider, request);
  assert.equal(duplicate.status, 200);
  assert.equal(store.updates, 2, 'duplicate delivery writes nothing');
  assert.equal(mail.receipts, 1, 'no second receipt');
  assert.equal(mail.adminNotices, 1, 'no second admin notice');
});
