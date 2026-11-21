// Ticket-path hardening fix 2: a payment notification answers 503 (retry) on a transient
// failure and keeps its existing 200 on every definitive outcome. Drives the REAL shared
// handler (lib/tickets-notification.ts) with lib/orders mocked and a fake payment provider.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/ticket-path-hardening/check-notification-retryable.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const ordersUrl = new URL('../../../lib/orders.ts', import.meta.url).href;
const state = { lookup: null };
mock.module(ordersUrl, {
  exports: {
    findReservedOrderByPaymentId: async () => {
      if (state.lookup instanceof Error) throw state.lookup;
      return state.lookup;
    },
    markOrderAndPositionPaidByPaymentId: async () => ({ committed: false, reason: 'x' }),
    markOrderPaymentPendingByPaymentId: async () => ({ committed: false, reason: 'x' }),
    ORDERS_COLLECTION: 'orders',
  },
});

const { POST } = await import('../../../lib/tickets-notification.ts');

function provider(confirm) {
  return {
    id: 'ozow',
    verifyNotification: async () => ({
      verified: true,
      notification: {
        reference: 'REF1',
        rawStatus: 'Complete',
        grossAmount: '10.00',
        grossAmountCents: 1000,
        gatewayPaymentId: 'T1',
        sourceIp: null,
        sourceIpTrusted: true,
        raw: {},
      },
    }),
    mapStatus: () => 'paid',
    confirmNotification: async () => confirm,
  };
}
const request = { text: async () => 'body', headers: new Headers() };
const reserved = { status: 'reserved', amount: 10, orderId: 'o1', expectedGatewayAmount: null };

test('order lookup throwing is transient: 503', async () => {
  state.lookup = new Error('firestore unavailable');
  const res = await POST(provider({ confirmed: true }), request);
  assert.equal(res.status, 503);
});

test('confirmation request-failed is transient: 503', async () => {
  state.lookup = reserved;
  const res = await POST(provider({ confirmed: false, reason: 'request-failed' }), request);
  assert.equal(res.status, 503);
});

test('definitive confirmation refusal keeps 200', async () => {
  state.lookup = reserved;
  const res = await POST(provider({ confirmed: false, reason: 'not-valid' }), request);
  assert.equal(res.status, 200);
});

test('unknown order keeps 200', async () => {
  state.lookup = { status: 'not-found' };
  const res = await POST(provider({ confirmed: true }), request);
  assert.equal(res.status, 200);
});

test('amount mismatch keeps 200', async () => {
  state.lookup = { ...reserved, amount: 99 };
  const res = await POST(provider({ confirmed: true }), request);
  assert.equal(res.status, 200);
});

test('already settled (duplicate) keeps 200', async () => {
  state.lookup = { status: 'already-settled', orderStatus: 'paid' };
  const res = await POST(provider({ confirmed: true }), request);
  assert.equal(res.status, 200);
});
