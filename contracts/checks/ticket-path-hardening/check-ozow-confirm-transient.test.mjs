// Ticket-path hardening fix 2 (gateway side): Ozow status confirmation maps a network error,
// timeout, 5xx, 408 and 429 to 'request-failed' (retryable), keeps any other non-2xx as the
// definitive 'not-valid', and passes an AbortSignal so a hung call cannot hang the request.
//
// Run as: npx tsx --test contracts/checks/ticket-path-hardening/check-ozow-confirm-transient.test.mjs

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createOzowProvider } from '../../../lib/payments/ozow.ts';

const ENV = {
  OZOW_SANDBOX_SITE_CODE: 'TESTSITE001',
  OZOW_SANDBOX_PRIVATE_KEY: 'not-used-by-confirm',
  OZOW_SANDBOX_API_KEY: 'test-api-key',
};
const notification = {
  reference: 'SAOC-2027-74NG1P6W9RKK',
  rawStatus: 'Complete',
  grossAmount: '0.01',
  grossAmountCents: 1,
  gatewayPaymentId: 'tx-1',
  sourceIp: null,
  sourceIpTrusted: null,
  raw: {},
};

async function confirmWith(fetchImpl) {
  const calls = [];
  const provider = createOzowProvider({
    env: ENV,
    fetch: async (url, init) => {
      calls.push(init);
      return fetchImpl();
    },
  });
  const result = await provider.confirmNotification(notification);
  return { result, calls };
}

for (const status of [500, 502, 503, 504, 408, 429]) {
  test(`HTTP ${status} is retryable`, async () => {
    const { result } = await confirmWith(() => ({ ok: false, status }));
    assert.deepEqual(result, { confirmed: false, reason: 'request-failed' });
  });
}

for (const status of [400, 401, 403, 404]) {
  test(`HTTP ${status} stays a definitive refusal`, async () => {
    const { result } = await confirmWith(() => ({ ok: false, status }));
    assert.deepEqual(result, { confirmed: false, reason: 'not-valid' });
  });
}

test('network error / timeout is retryable', async () => {
  const { result } = await confirmWith(() => {
    throw new DOMException('The operation timed out.', 'TimeoutError');
  });
  assert.deepEqual(result, { confirmed: false, reason: 'request-failed' });
});

test('status fetch carries an abort signal', async () => {
  const { calls } = await confirmWith(() => ({ ok: false, status: 500 }));
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test('verification is not weakened: a Complete row still confirms, a non-Complete one does not', async () => {
  const row = (Status) => [{ TransactionReference: notification.reference, TransactionId: 'tx-1', Status }];
  const ok = await confirmWith(() => ({ ok: true, status: 200, json: async () => row('Complete') }));
  assert.deepEqual(ok.result, { confirmed: true });
  const no = await confirmWith(() => ({ ok: true, status: 200, json: async () => row('Cancelled') }));
  assert.deepEqual(no.result, { confirmed: false, reason: 'not-valid' });
});

test('body read failing mid-stream (timeout/abort/network) is retryable, not a refusal', async () => {
  for (const make of [
    () => new DOMException('The operation timed out.', 'TimeoutError'),
    () => new DOMException('This operation was aborted', 'AbortError'),
    () => new TypeError('terminated'),
  ]) {
    const { result } = await confirmWith(() => ({
      ok: true,
      status: 200,
      json: async () => {
        throw make();
      },
    }));
    assert.deepEqual(result, { confirmed: false, reason: 'request-failed' });
  }
});

test('a body that arrived in full but is malformed stays a definitive refusal', async () => {
  const { result } = await confirmWith(() => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  }));
  assert.deepEqual(result, { confirmed: false, reason: 'not-valid' });
});
