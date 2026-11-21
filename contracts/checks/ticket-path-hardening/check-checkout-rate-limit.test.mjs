// Ticket-path hardening fix 1: POST /api/tickets/checkout is limited per IP, and the over-limit
// branch lets a buyer's genuine replay through without becoming an oracle or a free pass.
//
// Over-limit branch, in order:
//   (a) replay allowance already spent: 429, NO Firestore read, Retry-After from the replay limiter
//   (b) body unusable (malformed JSON, bad shape): 429, no read
//   (c) one lookup by Idempotency-Key, (d) stored reservation must be payable and match the body
//       (ticket type, attendee email, chosen day), else 429; on a match the stored hand-off is
//       returned straight from Firestore data, with ZERO Sanity (CMS) calls and ZERO stock scans.
// Every refusal is the identical 429 body, so an existing key looks like an unused one.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/ticket-path-hardening/check-checkout-rate-limit.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

import { consumeRateLimit } from '../../../lib/newsletter-rate-limit.ts';
import { createAttemptStore, scopeAttemptsToRequest } from '../../../lib/newsletter-rate-store.ts';

const realFirestore = await import('firebase-admin/firestore');
const realPayments = await import('../../../lib/payments/index.ts');
const realSanityClient = await import('../../../sanity/lib/client.ts');

// ---- fakes ------------------------------------------------------------------------------------

const calls = { cms: 0, transactions: 0, ticketQueries: 0, orderReads: 0 };
const data = { tickets: new Map(), orders: new Map() };
let failLookups = false;

const FAR_FUTURE = Timestamp.fromMillis(Date.UTC(2100, 0, 1));
const PAST = Timestamp.fromMillis(Date.UTC(2020, 0, 1));
const KEY = '3f2b8c1e-9d4a-4e6b-8a57-aaaaaaaaaaaa';

function seedReservation({ orderPatch = {}, email = 'buyer@saoc-check.invalid' } = {}) {
  data.tickets.clear();
  data.orders.clear();
  data.orders.set('order-1', {
    status: 'reserved',
    m_payment_id: 'SAOC-2027-REPLAYREF1',
    gateway: 'ozow',
    amount: 100,
    expectedGatewayAmount: null,
    expiresAt: FAR_FUTURE,
    ...orderPatch,
  });
  data.tickets.set('pos-1', {
    idempotencyKey: KEY,
    ticketType: 'general-admission',
    attendeeEmail: email,
    chosenDay: null,
    orderId: 'order-1',
  });
}

const fakeDb = {
  collection: (name) => ({
    where: (field, op, value) => ({
      get: async () => {
        calls.ticketQueries += 1;
        if (failLookups) throw new Error('firestore unavailable');
        const docs = [...data.tickets.entries()]
          .filter(([, d]) => name === 'tickets' && d[field] === value)
          .map(([id, d]) => ({ id, data: () => d }));
        return { empty: docs.length === 0, docs };
      },
      limit: () => ({ get: async () => ({ empty: true, docs: [] }) }),
    }),
    doc: (id) => ({
      get: async () => {
        calls.orderReads += 1;
        const d = data.orders.get(id);
        return { id, exists: d !== undefined, data: () => d };
      },
    }),
  }),
  runTransaction: async () => {
    calls.transactions += 1;
    throw new Error('no stock scan expected');
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
        throw new Error('no CMS call expected');
      },
    },
  },
});
const fakeProvider = {
  initiate: async () => ({
    ok: true,
    processUrl: 'https://pay.example.invalid/process',
    fields: { Reference: 'x' },
  }),
};
mock.module(new URL('../../../lib/payments/index.ts', import.meta.url).href, {
  exports: { ...realPayments, resolveProvider: () => fakeProvider },
});

const { POST } = await import('../../../app/api/tickets/checkout/route.ts');

// ---- helpers ----------------------------------------------------------------------------------

let ipCounter = 0;
const freshIp = () => `198.51.100.${++ipCounter}`;
let keyCounter = 0;
const freshKey = () => `3f2b8c1e-9d4a-4e6b-8a57-${String(++keyCounter).padStart(12, '0')}`;

const validBody = (email = 'buyer@saoc-check.invalid') =>
  JSON.stringify({
    showId: 'nationalShow',
    lineItems: [{ ticketType: 'general-admission', attendeeName: 'Buyer', attendeeEmail: email }],
  });

function post(ip, key, body) {
  const headers = {
    'x-forwarded-for': `${ip}, 10.0.0.1`,
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(body)),
  };
  if (key) headers['idempotency-key'] = key;
  return POST(new NextRequest('http://localhost/api/tickets/checkout', { method: 'POST', headers, body }));
}

/** Trips the per-IP limiter with 10 requests that all stop at body parsing (400). */
async function tripLimiter(ip) {
  for (let i = 0; i < 10; i++) {
    assert.equal((await post(ip, freshKey(), 'not json')).status, 400);
  }
}

function resetCalls() {
  calls.cms = 0;
  calls.transactions = 0;
  calls.ticketQueries = 0;
  calls.orderReads = 0;
}

async function snapshotOf(res) {
  return { status: res.status, body: await res.json(), retryAfter: res.headers.get('Retry-After') };
}

// ---- tests ------------------------------------------------------------------------------------

test('the 11th fresh checkout from one IP is a 429 with Retry-After; an unknown key costs one lookup', async () => {
  seedReservation();
  const ip = freshIp();
  await tripLimiter(ip);
  resetCalls();
  const res = await post(ip, freshKey(), validBody());
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: 'Too many attempts. Please try again later.' });
  assert.ok(Number(res.headers.get('Retry-After')) > 0);
  assert.equal(calls.cms, 0);
  assert.equal(calls.transactions, 0);
  assert.equal(calls.ticketQueries, 1, 'one lookup by key');
  assert.equal(calls.orderReads, 0, 'an unknown key never reaches the order read');
});

test('(c)+(d) a genuine replay over the limit is served from the stored reservation: no CMS, no stock scan', async () => {
  seedReservation();
  const ip = freshIp();
  await tripLimiter(ip);
  resetCalls();
  const res = await post(ip, KEY, validBody('Buyer@SAOC-check.invalid'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.bookingRef, 'SAOC-2027-REPLAYREF1');
  assert.equal(json.providerId, 'ozow');
  assert.equal(json.amount, '100.00');
  assert.deepEqual(json.positions, [{ bookingRef: 'pos-1', ticketType: 'general-admission' }]);
  assert.equal(json.processUrl, 'https://pay.example.invalid/process');
  assert.equal(calls.cms, 0, 'zero Sanity calls');
  assert.equal(calls.transactions, 0, 'zero stock scans');
  assert.equal(calls.ticketQueries, 1, 'one lookup by key');
  assert.equal(calls.orderReads, 1);
});

test('(d) an existing key with a different email is the same 429 as an unused key; zero CMS and stock calls', async () => {
  seedReservation();
  const ip = freshIp();
  await tripLimiter(ip);
  resetCalls();
  const mismatch = await snapshotOf(await post(ip, KEY, validBody('someone-else@saoc-check.invalid')));
  const unknown = await snapshotOf(await post(ip, freshKey(), validBody()));
  assert.equal(mismatch.status, 429);
  assert.deepEqual(mismatch, unknown, 'identical status, body and Retry-After');
  assert.equal(calls.cms, 0);
  assert.equal(calls.transactions, 0);
});

test('(d) a different ticket type, a paid order and an expired reservation are all the same 429', async () => {
  const ip = freshIp();
  seedReservation();
  await tripLimiter(ip);
  const baseline = await snapshotOf(await post(ip, freshKey(), validBody()));

  const otherType = JSON.stringify({
    showId: 'nationalShow',
    lineItems: [{ ticketType: 'student', attendeeName: 'Buyer', attendeeEmail: 'buyer@saoc-check.invalid' }],
  });
  resetCalls();
  assert.deepEqual(await snapshotOf(await post(ip, KEY, otherType)), baseline);

  seedReservation({ orderPatch: { status: 'paid' } });
  assert.deepEqual(await snapshotOf(await post(ip, KEY, validBody())), baseline);

  seedReservation({ orderPatch: { expiresAt: PAST } });
  assert.deepEqual(await snapshotOf(await post(ip, KEY, validBody())), baseline);
  assert.equal(calls.cms, 0);
  assert.equal(calls.transactions, 0);
});

test('(b) malformed JSON or a bad shape with an EXISTING key is 429, identical, and reads nothing', async () => {
  seedReservation();
  const ip = freshIp();
  await tripLimiter(ip);
  const baseline = await snapshotOf(await post(ip, freshKey(), 'not json'));
  resetCalls();
  assert.deepEqual(await snapshotOf(await post(ip, KEY, 'not json')), baseline);
  assert.deepEqual(await snapshotOf(await post(ip, KEY, '{"showId":"wrong","lineItems":[]}')), baseline);
  assert.deepEqual(await snapshotOf(await post(ip, KEY, 'null')), baseline);
  assert.equal(baseline.status, 429);
  assert.equal(calls.ticketQueries, 0, 'no lookup for an unusable body');
  assert.equal(calls.orderReads, 0);
});

test('a failing lookup fails closed with the same 429', async () => {
  seedReservation();
  const ip = freshIp();
  await tripLimiter(ip);
  const baseline = await snapshotOf(await post(ip, freshKey(), validBody()));
  failLookups = true;
  try {
    assert.deepEqual(await snapshotOf(await post(ip, KEY, validBody())), baseline);
  } finally {
    failLookups = false;
  }
});

test('(a) once the 30-replay allowance is spent: 429, no Firestore read, Retry-After from the REPLAY limiter', async () => {
  seedReservation();
  const ip = freshIp();
  mock.timers.enable({ apis: ['Date'], now: Date.now() });
  try {
    // Mirror both limiters with independent stores so the expected Retry-After is computed, not guessed.
    const windowMs = 10 * 60_000;
    const mirrorMain = createAttemptStore(windowMs);
    const mirrorReplay = createAttemptStore(windowMs);
    const consume = (store, key, max) =>
      consumeRateLimit({ now: new Date(), ...scopeAttemptsToRequest(store) }, key, max, windowMs);

    for (let i = 0; i < 10; i++) {
      consume(mirrorMain, `ticket-checkout:${ip}`, 10);
      assert.equal((await post(ip, freshKey(), 'not json')).status, 400);
    }
    mock.timers.tick(60_000);
    for (let i = 0; i < 30; i++) {
      consume(mirrorMain, `ticket-checkout:${ip}`, 10);
      consume(mirrorReplay, `ticket-checkout-replay:${ip}`, 30);
      assert.equal((await post(ip, KEY, validBody())).status, 200, `replay ${i + 1}`);
      mock.timers.tick(10_000);
    }
    const mainNow = consume(mirrorMain, `ticket-checkout:${ip}`, 10);
    const replayNow = consume(mirrorReplay, `ticket-checkout-replay:${ip}`, 30);
    assert.equal(replayNow.allowed, false);
    assert.notEqual(replayNow.retryAfterSeconds, mainNow.retryAfterSeconds, 'limiters must be distinguishable');

    resetCalls();
    const res = await post(ip, KEY, validBody());
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { error: 'Too many attempts. Please try again later.' });
    assert.equal(res.headers.get('Retry-After'), String(replayNow.retryAfterSeconds));
    assert.equal(calls.ticketQueries, 0, 'no Firestore read once the replay allowance is spent');
    assert.equal(calls.orderReads, 0);
    assert.equal(calls.cms, 0);
  } finally {
    mock.timers.reset();
  }
});

test('a different IP is not affected', async () => {
  assert.equal((await post(freshIp(), freshKey(), 'not json')).status, 400);
});

test('a missing Idempotency-Key is still 400 and uses no allowance', async () => {
  const ip = freshIp();
  for (let i = 0; i < 12; i++) assert.equal((await post(ip, '', 'not json')).status, 400);
  assert.equal((await post(ip, freshKey(), 'not json')).status, 400);
});
