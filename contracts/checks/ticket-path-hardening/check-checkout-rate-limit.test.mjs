// Ticket-path hardening fix 1: POST /api/tickets/checkout is limited per IP. The limiter runs
// before any body parse, Firestore or Sanity work, so the 11th request inside the window gets the
// same 429 as the status route; a different IP is unaffected. A request without a valid
// Idempotency-Key is still rejected 400 first, and does not consume the allowance.
//
// Run as: npx tsx --test contracts/checks/ticket-path-hardening/check-checkout-rate-limit.test.mjs

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NextRequest } from 'next/server';

import { POST } from '../../../app/api/tickets/checkout/route.ts';

const KEY = '3f2b8c1e-9d4a-4e6b-8a57-1c2d3e4f5a6b';

function request(ip, key = KEY) {
  const headers = { 'x-forwarded-for': `${ip}, 10.0.0.1`, 'content-type': 'application/json', 'content-length': '8' };
  if (key) headers['idempotency-key'] = key;
  // Invalid JSON: a request that gets past the limiter fails fast with 400 and touches nothing.
  return new NextRequest('http://localhost/api/tickets/checkout', {
    method: 'POST',
    headers,
    body: 'not json',
  });
}

test('the 11th checkout from one IP in the window is a 429 with Retry-After', async () => {
  for (let i = 0; i < 10; i++) {
    const res = await POST(request('203.0.113.7'));
    assert.equal(res.status, 400, `attempt ${i + 1} passes the limiter`);
  }
  const limited = await POST(request('203.0.113.7'));
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: 'Too many attempts. Please try again later.' });
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
});

test('a different IP is not affected', async () => {
  const res = await POST(request('203.0.113.99'));
  assert.equal(res.status, 400);
});

test('a missing Idempotency-Key is still 400 and uses no allowance', async () => {
  for (let i = 0; i < 12; i++) {
    const res = await POST(request('203.0.113.50', ''));
    assert.equal(res.status, 400);
  }
  const res = await POST(request('203.0.113.50'));
  assert.equal(res.status, 400);
});
