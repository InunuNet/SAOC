// Public-endpoint hardening F11: both payment notification routes cap the body they read.
//
// An oversize notification is acknowledged with the handler's own `{received:true}` 200 shape
// (so the sender does not retry) and never reaches the shared handler, which means it triggers
// none of the handler's per-rejection logging or verification work. A normal notification, with
// or without a Content-Length header, reaches the handler with its body intact.
//
// The attacker-controlled `reference` that lib/tickets-notification.ts logs on a rejection is
// bounded by this cap (16 KB) but not truncated: that file is owned by another PR.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/public-endpoint-hardening/check-notification-body-cap.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { NextRequest, NextResponse } from 'next/server';

const MAX_BODY = 16 * 1024;
const seen = [];

mock.module(new URL('../../../lib/tickets-notification.ts', import.meta.url).href, {
  exports: {
    POST: async (provider, request) => {
      seen.push({ provider: provider.id, body: await request.text(), type: request.headers.get('content-type') });
      return NextResponse.json({ received: true }, { status: 200 });
    },
  },
});
mock.module(new URL('../../../lib/payments/ozow.ts', import.meta.url).href, {
  exports: { ozowProvider: { id: 'ozow' } },
});
mock.module(new URL('../../../lib/payments/payfast.ts', import.meta.url).href, {
  exports: { payfastProvider: { id: 'payfast' } },
});

const ozow = await import('../../../app/api/tickets/ozow-itn/route.ts');
const payfast = await import('../../../app/api/tickets/itn/route.ts');

const FORM = 'application/x-www-form-urlencoded';

function request(path, body, headers = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': FORM, ...headers },
    body,
  });
}

const ROUTES = [
  ['ozow-itn', ozow, '/api/tickets/ozow-itn', 'ozow'],
  ['itn', payfast, '/api/tickets/itn', 'payfast'],
];

for (const [name, route, path, providerId] of ROUTES) {
  test(`${name}: a normal notification reaches the handler with its body and provider intact`, async () => {
    seen.length = 0;
    const body = 'SiteCode=X&TransactionReference=ORD-1&Status=Complete&Hash=abc';
    const res = await route.POST(request(path, body, { 'content-length': String(body.length) }));
    assert.equal(res.status, 200);
    assert.deepEqual(seen, [{ provider: providerId, body, type: FORM }]);
  });

  test(`${name}: a declared oversize body is acknowledged without reaching the handler`, async () => {
    seen.length = 0;
    const body = `TransactionReference=${'A'.repeat(MAX_BODY)}`;
    const res = await route.POST(request(path, body, { 'content-length': String(body.length) }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { received: true });
    assert.equal(seen.length, 0);
  });

  test(`${name}: an oversize body with no Content-Length is cut off while streaming`, async () => {
    seen.length = 0;
    const chunk = new TextEncoder().encode('A'.repeat(4096));
    let sent = 0;
    const stream = new ReadableStream({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
        if (sent > 100) controller.close();
      },
    });
    const chunked = new NextRequest(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': FORM },
      body: stream,
      duplex: 'half',
    });
    const res = await route.POST(chunked);
    assert.equal(res.status, 200);
    assert.equal(seen.length, 0);
    assert.ok(sent < 10, `stopped reading after ${sent} chunks`);
  });

  test(`${name}: a normal body without Content-Length (chunked sender) is still served`, async () => {
    seen.length = 0;
    const text = 'TransactionReference=ORD-2&Status=Complete';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
    const chunked = new NextRequest(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': FORM },
      body: stream,
      duplex: 'half',
    });
    const res = await route.POST(chunked);
    assert.equal(res.status, 200);
    assert.deepEqual(seen, [{ provider: providerId, body: text, type: FORM }]);
  });
}
