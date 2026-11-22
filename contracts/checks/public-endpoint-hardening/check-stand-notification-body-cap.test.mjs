// Public-endpoint hardening: the vendor stand-payment notification handler (shared by the
// PayFast and Ozow stand routes) caps the body it reads at 16 KiB, like the ticket routes.
//
// An oversize body, even one whose Content-Length understates it, is acknowledged with the
// handler's own `{received:true}` 200 and never reaches verification. A normal notification
// still reaches the provider's verifyNotification with its body intact. readBodyCapped
// (admin session route) returns its overflow result whether cancel never settles or rejects.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/public-endpoint-hardening/check-stand-notification-body-cap.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { NextRequest } from 'next/server';

mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => ({}) },
});

const { POST } = await import('../../../lib/vendor-stand-payment-notification.ts');
const { readBodyCapped } = await import('../../../lib/admin-session-body.ts');

const MAX_BODY = 16 * 1024;
const FORM = 'application/x-www-form-urlencoded';

function fakeProvider() {
  const calls = [];
  return {
    calls,
    provider: {
      id: 'ozow',
      verifyNotification: async (input) => {
        calls.push(input.rawBody);
        return { verified: false, reason: 'test', reference: null };
      },
    },
  };
}

function request(body, headers = {}) {
  return new NextRequest('http://localhost/api/vendors/stand-payment/ozow-itn', {
    method: 'POST',
    headers: { 'content-type': FORM, ...headers },
    body,
    duplex: 'half',
  });
}

test('a normal notification reaches verification with its body intact', async () => {
  const { provider, calls } = fakeProvider();
  const body = 'TransactionReference=VSO-abc&Status=Complete';
  const res = await POST(provider, request(body, { 'content-length': String(body.length) }), {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { received: true });
  assert.deepEqual(calls, [body]);
});

test('an oversize body with an understated Content-Length is acknowledged, never verified', async () => {
  const { provider, calls } = fakeProvider();
  const body = `TransactionReference=${'A'.repeat(MAX_BODY)}`;
  const res = await POST(provider, request(body, { 'content-length': '10' }), {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { received: true });
  assert.equal(calls.length, 0);
});

test('an oversize body with no Content-Length is cut off while streaming', async () => {
  const { provider, calls } = fakeProvider();
  const chunk = new TextEncoder().encode('A'.repeat(4096));
  let sent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      sent += 1;
      controller.enqueue(chunk);
      if (sent > 100) controller.close();
    },
  });
  const res = await POST(provider, request(stream), {});
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
  assert.ok(sent < 10, `stopped reading after ${sent} chunks`);
});

function sourceWithCancel(cancel) {
  const chunk = new TextEncoder().encode('x'.repeat(100));
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(chunk);
    },
    cancel,
  });
  return new Request('http://localhost/api/admin/session', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  });
}

test('readBodyCapped returns too-large when cancel never settles', async () => {
  const req = sourceWithCancel(() => new Promise(() => undefined));
  const TIMEOUT_MS = 500;
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => resolve('hung'), TIMEOUT_MS);
  });
  const result = await Promise.race([readBodyCapped(req, 50), timedOut]);
  clearTimeout(timer);
  assert.deepEqual(result, { ok: false, reason: 'too-large' });
});

test('readBodyCapped returns too-large when cancel rejects', async () => {
  const req = sourceWithCancel(() => Promise.reject(new Error('cancel failed')));
  const result = await readBodyCapped(req, 50);
  assert.deepEqual(result, { ok: false, reason: 'too-large' });
});
