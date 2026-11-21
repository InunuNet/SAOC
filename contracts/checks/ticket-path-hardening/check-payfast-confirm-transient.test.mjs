// Ticket-path hardening fix 2 (PayFast side): the validate round trip maps a network error,
// timeout, 5xx, 408 and 429 to 'request-failed' (retryable, so the handler answers 503), while
// any other non-VALID reply stays the definitive 'not-valid'. VALID still confirms.
// Also proves the handler turns the PayFast 429 into a 503 end to end.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/ticket-path-hardening/check-payfast-confirm-transient.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const state = { lookup: { status: 'reserved', amount: 10, orderId: 'o1', expectedGatewayAmount: null } };
mock.module(new URL('../../../lib/orders.ts', import.meta.url).href, {
  exports: {
    findReservedOrderByPaymentId: async () => state.lookup,
    markOrderAndPositionPaidByPaymentId: async () => ({ committed: false, reason: 'x' }),
    markOrderPaymentPendingByPaymentId: async () => ({ committed: false, reason: 'x' }),
    ORDERS_COLLECTION: 'orders',
  },
});

const { createPayfastProvider } = await import('../../../lib/payments/payfast.ts');
const { POST } = await import('../../../lib/tickets-notification.ts');

const ENV = {
  PAYFAST_SANDBOX_MERCHANT_ID: '10000100',
  PAYFAST_SANDBOX_MERCHANT_KEY: 'test-merchant-key-not-real',
  PAYFAST_SANDBOX_PASSPHRASE: 'test-passphrase',
};
const notification = {
  reference: 'SAOC-2027-PAYFAST0001',
  rawStatus: 'COMPLETE',
  grossAmount: '10.00',
  grossAmountCents: 1000,
  gatewayPaymentId: 'pf-1',
  sourceIp: null,
  sourceIpTrusted: null,
  raw: { m_payment_id: 'SAOC-2027-PAYFAST0001', payment_status: 'COMPLETE', amount_gross: '10.00' },
};

function providerWith(fetchImpl) {
  const calls = [];
  const provider = createPayfastProvider({
    env: ENV,
    fetch: async (url, init) => {
      calls.push(init);
      return fetchImpl();
    },
  });
  return { provider, calls };
}
const reply = (status, text = '') => () => ({ ok: status < 400, status, text: async () => text });

for (const status of [500, 503, 408, 429]) {
  test(`PayFast validate HTTP ${status} is retryable`, async () => {
    const { provider } = providerWith(reply(status));
    assert.deepEqual(await provider.confirmNotification(notification), {
      confirmed: false,
      reason: 'request-failed',
    });
  });
}

test('PayFast validate network error / timeout is retryable', async () => {
  const { provider } = providerWith(() => {
    throw new DOMException('The operation timed out.', 'TimeoutError');
  });
  assert.deepEqual(await provider.confirmNotification(notification), {
    confirmed: false,
    reason: 'request-failed',
  });
});

test('PayFast validate carries an abort signal', async () => {
  const { provider, calls } = providerWith(reply(200, 'VALID'));
  await provider.confirmNotification(notification);
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test('INVALID body and a plain 400 stay definitive refusals; VALID confirms', async () => {
  for (const make of [reply(200, 'INVALID'), reply(400, 'bad request')]) {
    const { provider } = providerWith(make);
    assert.deepEqual(await provider.confirmNotification(notification), {
      confirmed: false,
      reason: 'not-valid',
    });
  }
  const { provider } = providerWith(reply(200, 'VALID'));
  assert.deepEqual(await provider.confirmNotification(notification), { confirmed: true });
});

test('handler answers 503 when PayFast validate returns 429', async () => {
  const { provider } = providerWith(reply(429));
  const handlerProvider = {
    ...provider,
    verifyNotification: async () => ({ verified: true, notification }),
  };
  const res = await POST(handlerProvider, { text: async () => 'x', headers: new Headers() });
  assert.equal(res.status, 503);
});
