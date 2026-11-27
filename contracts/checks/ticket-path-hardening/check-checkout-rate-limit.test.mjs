// Ticket-path hardening fix 1: POST /api/tickets/checkout is limited per IP.
//
// Over the limit is one uniform 429 with the limiter's Retry-After, for EVERY request: the same
// for an Idempotency-Key that already has a reservation, an unused key and a malformed body, and
// with zero Firestore and zero Sanity calls (lead ruling 21 Nov 2026: no I/O and no key-existence
// signal on the over-limit path). Under the limit the route is untouched, so a replay still goes
// through the normal replay logic (its response is pinned by
// contracts/checks/ticketing-multi-line-item-cart/check-idempotency-replay-full-set.mjs); once the
// window passes, the same key is served again.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/ticket-path-hardening/check-checkout-rate-limit.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { NextRequest } from 'next/server';

import { CURRENT_TERMS_VERSIONS } from '../../../lib/checkout-terms.ts';

const realFirestore = await import('firebase-admin/firestore');
const realSanityClient = await import('../../../sanity/lib/client.ts');

const calls = { firestore: 0, cms: 0 };
const touch = () => {
  calls.firestore += 1;
};
const fakeDb = {
  collection: () => ({
    doc: () => ({
      get: async () => {
        touch();
        return { exists: false, data: () => undefined };
      },
    }),
    where: () => ({
      get: async () => {
        touch();
        return { empty: true, docs: [] };
      },
    }),
    get: async () => {
      touch();
      return { empty: true, docs: [] };
    },
  }),
  runTransaction: async () => {
    touch();
    throw new Error('no transaction expected');
  },
};
mock.module('firebase-admin/firestore', {
  exports: { ...realFirestore, getFirestore: () => fakeDb },
});
mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => ({}) },
});
mock.module(new URL('../../../sanity/lib/client.ts', import.meta.url).href, {
  exports: {
    ...realSanityClient,
    client: {
      fetch: async () => {
        calls.cms += 1;
        throw new Error('cms unavailable in test');
      },
    },
  },
});

const { POST } = await import('../../../app/api/tickets/checkout/route.ts');

const EXISTING_KEY = '3f2b8c1e-9d4a-4e6b-8a57-aaaaaaaaaaaa';
let ipCounter = 0;
const freshIp = () => `198.51.100.${++ipCounter}`;
let keyCounter = 0;
const freshKey = () => `3f2b8c1e-9d4a-4e6b-8a57-${String(++keyCounter).padStart(12, '0')}`;

const validBody = JSON.stringify({
  termsAccepted: true,
  ...CURRENT_TERMS_VERSIONS,
  showId: 'nationalShow',
  lineItems: [
    { ticketType: 'general-admission', attendeeName: 'Buyer', attendeeEmail: 'buyer@saoc-check.invalid' },
  ],
});

function post(ip, key, body, extraHeaders = {}) {
  const headers = {
    'x-forwarded-for': `${ip}, 10.0.0.1, 10.0.0.2`,
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(body)),
    ...extraHeaders,
  };
  if (key) headers['idempotency-key'] = key;
  return POST(new NextRequest('http://localhost/api/tickets/checkout', { method: 'POST', headers, body }));
}

async function tripLimiter(ip) {
  for (let i = 0; i < 10; i++) {
    assert.equal((await post(ip, freshKey(), 'not json')).status, 400);
  }
}

const reset = () => {
  calls.firestore = 0;
  calls.cms = 0;
};

async function snapshotOf(res) {
  return { status: res.status, body: await res.json(), retryAfter: res.headers.get('Retry-After') };
}

test('over the limit: identical 429 for an existing key, an unused key and a malformed body, with no I/O', async () => {
  const ip = freshIp();
  await tripLimiter(ip);
  reset();

  const existingKey = await snapshotOf(await post(ip, EXISTING_KEY, validBody));
  const unusedKey = await snapshotOf(await post(ip, freshKey(), validBody));
  const malformed = await snapshotOf(await post(ip, EXISTING_KEY, 'not json'));
  const badShape = await snapshotOf(await post(ip, freshKey(), '{"showId":"wrong","lineItems":[]}'));

  assert.equal(existingKey.status, 429);
  assert.deepEqual(existingKey.body, { error: 'Too many attempts. Please try again later.' });
  assert.ok(Number(existingKey.retryAfter) > 0, 'Retry-After comes from the limiter');
  assert.deepEqual(unusedKey, existingKey);
  assert.deepEqual(malformed, existingKey);
  assert.deepEqual(badShape, existingKey);
  assert.equal(calls.firestore, 0, 'zero Firestore calls over the limit');
  assert.equal(calls.cms, 0, 'zero Sanity calls over the limit');
});

test('under the limit a replayed key is not refused: it reaches the normal checkout flow', async () => {
  const ip = freshIp();
  for (let i = 0; i < 10; i++) {
    reset();
    const res = await post(ip, EXISTING_KEY, validBody);
    assert.notEqual(res.status, 429, `request ${i + 1} is under the limit`);
    assert.ok(calls.firestore + calls.cms > 0, 'the normal flow ran (replay logic is untouched)');
  }
});

test('after the window passes the same key is served again', async () => {
  const ip = freshIp();
  mock.timers.enable({ apis: ['Date'], now: Date.now() });
  try {
    for (let i = 0; i < 10; i++) await post(ip, EXISTING_KEY, 'not json');
    assert.equal((await post(ip, EXISTING_KEY, 'not json')).status, 429);
    mock.timers.tick(10 * 60_000 + 1000);
    reset();
    const res = await post(ip, EXISTING_KEY, validBody);
    assert.notEqual(res.status, 429);
    assert.ok(calls.firestore + calls.cms > 0, 'reached the normal flow again');
  } finally {
    mock.timers.reset();
  }
});

test('a different IP is not affected', async () => {
  assert.equal((await post(freshIp(), freshKey(), 'not json')).status, 400);
});

test('under the limit: a missing Idempotency-Key is still 400 and an oversized body still 413', async () => {
  const ip = freshIp();
  assert.equal((await post(ip, '', 'not json')).status, 400);
  assert.equal((await post(ip, freshKey(), 'not json', { 'content-length': '131073' })).status, 413);
});

test('over the limit: no Idempotency-Key and an oversized body both get the same uniform 429', async () => {
  const ip = freshIp();
  await tripLimiter(ip);
  reset();
  const baseline = await snapshotOf(await post(ip, freshKey(), validBody));
  const noKey = await snapshotOf(await post(ip, '', 'not json'));
  const oversized = await snapshotOf(
    await post(ip, freshKey(), 'not json', { 'content-length': '131073' })
  );
  assert.equal(baseline.status, 429);
  assert.deepEqual(noKey, baseline);
  assert.deepEqual(oversized, baseline);
  assert.equal(calls.firestore, 0);
  assert.equal(calls.cms, 0);
});

test('requests without a key or with an oversized body count toward the limit', async () => {
  const ip = freshIp();
  for (let i = 0; i < 5; i++) assert.equal((await post(ip, '', 'not json')).status, 400);
  for (let i = 0; i < 5; i++) {
    const res = await post(ip, freshKey(), 'not json', { 'content-length': '131073' });
    assert.equal(res.status, 413);
  }
  assert.equal((await post(ip, freshKey(), 'not json')).status, 429);
});
