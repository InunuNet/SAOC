// Ticket-path hardening fix 1: POST /api/tickets/checkout is limited per IP, and a replay of an
// Idempotency-Key that already created a reservation still gets through the limiter.
//
// - the 11th fresh checkout from one IP in the window is a 429 (same wording as the status route)
//   and costs at most ONE Firestore read (the replay lookup): no stock scan, no Sanity;
// - once limited, a key that already has a ticket is let through to the normal replay path
//   (it reaches body parsing, so a bad body gives 400, not 429);
// - replays have their own, larger allowance, so one real key cannot bypass the limit forever;
// - a failing lookup fails closed (429);
// - a missing/invalid Idempotency-Key is still 400 first and uses no allowance.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/ticket-path-hardening/check-checkout-rate-limit.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { NextRequest } from 'next/server';

const realFirestore = await import('firebase-admin/firestore');

const lookups = { calls: [], existingKeys: new Set(), failNext: false, otherReads: 0 };
const fakeDb = {
  collection: (name) => ({
    where: (field, op, value) => ({
      limit: () => ({
        get: async () => {
          lookups.calls.push({ name, field, op, value });
          if (lookups.failNext) throw new Error('firestore unavailable');
          const found = lookups.existingKeys.has(value);
          return { empty: !found, docs: found ? [{ id: 'pos-1' }] : [] };
        },
      }),
      get: async () => {
        lookups.otherReads += 1;
        return { empty: true, docs: [] };
      },
    }),
  }),
  runTransaction: async () => {
    lookups.otherReads += 1;
    throw new Error('no stock scan expected');
  },
};
mock.module('firebase-admin/firestore', {
  exports: { ...realFirestore, getFirestore: () => fakeDb },
});
mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => ({}) },
});

const { POST } = await import('../../../app/api/tickets/checkout/route.ts');

let keyCounter = 0;
const freshKey = () => `3f2b8c1e-9d4a-4e6b-8a57-${String(++keyCounter).padStart(12, '0')}`;

function request(ip, key) {
  const headers = {
    'x-forwarded-for': `${ip}, 10.0.0.1`,
    'content-type': 'application/json',
    'content-length': '8',
  };
  if (key) headers['idempotency-key'] = key;
  // Invalid JSON: a request that gets past the limiter fails fast with 400 and touches nothing.
  return new NextRequest('http://localhost/api/tickets/checkout', {
    method: 'POST',
    headers,
    body: 'not json',
  });
}

test('the 11th fresh checkout from one IP is a 429 with Retry-After and costs one read', async () => {
  const ip = '203.0.113.7';
  for (let i = 0; i < 10; i++) {
    const res = await POST(request(ip, freshKey()));
    assert.equal(res.status, 400, `attempt ${i + 1} passes the limiter`);
  }
  assert.equal(lookups.calls.length, 0, 'under the limit there is no lookup at all');

  const limited = await POST(request(ip, freshKey()));
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: 'Too many attempts. Please try again later.' });
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  assert.equal(lookups.calls.length, 1, 'exactly one lookup for the blocked fresh key');
  assert.equal(lookups.calls[0].name, 'tickets');
  assert.equal(lookups.calls[0].field, 'idempotencyKey');
  assert.equal(lookups.otherReads, 0, 'no stock scan, no transaction');
});

test('a replay of an existing key is served past the limit; a fresh key is still 429', async () => {
  const ip = '203.0.113.8';
  for (let i = 0; i < 10; i++) await POST(request(ip, freshKey()));
  const replayKey = freshKey();
  lookups.existingKeys.add(replayKey);

  const replay = await POST(request(ip, replayKey));
  assert.equal(replay.status, 400, 'passed the limiter into normal handling (bad body)');
  assert.equal((await POST(request(ip, freshKey()))).status, 429);
});

test('replays draw on their own allowance of 30, then are limited too', async () => {
  const ip = '203.0.113.9';
  for (let i = 0; i < 10; i++) await POST(request(ip, freshKey()));
  const replayKey = freshKey();
  lookups.existingKeys.add(replayKey);
  for (let i = 0; i < 30; i++) {
    assert.equal((await POST(request(ip, replayKey))).status, 400, `replay ${i + 1}`);
  }
  assert.equal((await POST(request(ip, replayKey))).status, 429);
});

test('a failing replay lookup fails closed with 429', async () => {
  const ip = '203.0.113.10';
  for (let i = 0; i < 10; i++) await POST(request(ip, freshKey()));
  lookups.failNext = true;
  try {
    assert.equal((await POST(request(ip, freshKey()))).status, 429);
  } finally {
    lookups.failNext = false;
  }
});

test('a different IP is not affected', async () => {
  assert.equal((await POST(request('203.0.113.99', freshKey()))).status, 400);
});

test('a missing Idempotency-Key is still 400 and uses no allowance', async () => {
  const ip = '203.0.113.50';
  for (let i = 0; i < 12; i++) assert.equal((await POST(request(ip, ''))).status, 400);
  assert.equal((await POST(request(ip, freshKey()))).status, 400);
});
