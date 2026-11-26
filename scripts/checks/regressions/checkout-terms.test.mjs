// Terms acceptance at checkout (Terms 5.1 and 7): the route refuses a missing, false or stale
// acceptance with 400 before any Sanity read, reservation or gateway call, and the reservation
// builder stamps the accepted versions on the order without undefined own-properties.
//   npx tsx --test --experimental-test-module-mocks scripts/checks/regressions/checkout-terms.test.mjs
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { NextRequest } from 'next/server';

const realFirestore = await import('firebase-admin/firestore');
const realSanityClient = await import('../../../sanity/lib/client.ts');

const calls = { firestore: 0, cms: 0 };
const touch = () => {
  calls.firestore += 1;
};
const fakeDb = {
  collection: () => ({
    doc: () => ({ get: async () => (touch(), { exists: false, data: () => undefined }) }),
    where: () => ({ get: async () => (touch(), { empty: true, docs: [] }) }),
    get: async () => (touch(), { empty: true, docs: [] }),
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
const { CURRENT_TERMS_VERSIONS, checkTermsAcceptance } = await import('../../../lib/checkout-terms.ts');
const { buildMultiReservationDocs } = await import('../../../lib/checkout-reservation.ts');

let counter = 0;
function post(extra) {
  counter += 1;
  const body = JSON.stringify({
    showId: 'nationalShow',
    lineItems: [
      { ticketType: 'general-admission', attendeeName: 'Buyer', attendeeEmail: 'buyer@saoc-check.invalid' },
    ],
    ...extra,
  });
  return POST(
    new NextRequest('http://localhost/api/tickets/checkout', {
      method: 'POST',
      headers: {
        'x-forwarded-for': `203.0.113.${counter}`,
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
        'idempotency-key': `3f2b8c1e-9d4a-4e6b-8a57-${String(counter).padStart(12, '0')}`,
      },
      body,
    }),
  );
}

async function assertRefusedBeforeAnyWork(extra) {
  calls.firestore = 0;
  calls.cms = 0;
  const res = await post(extra);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /accept|updated/i);
  assert.equal(calls.firestore + calls.cms, 0, 'no Firestore or Sanity work before the refusal');
}

test('route: acceptance missing is a 400 before any work', () => assertRefusedBeforeAnyWork({}));
test('route: termsAccepted false is a 400 before any work', () =>
  assertRefusedBeforeAnyWork({ termsAccepted: false, ...CURRENT_TERMS_VERSIONS }));
test('route: a non-boolean true-ish value is refused', () =>
  assertRefusedBeforeAnyWork({ termsAccepted: 'true', ...CURRENT_TERMS_VERSIONS }));
test('route: a stale terms version is a 400 before any work', () =>
  assertRefusedBeforeAnyWork({ termsAccepted: true, ...CURRENT_TERMS_VERSIONS, termsVersion: '01/01/2020' }));
test('route: a stale refund policy version is a 400 before any work', () =>
  assertRefusedBeforeAnyWork({ termsAccepted: true, ...CURRENT_TERMS_VERSIONS, refundPolicyVersion: '01/01/2020' }));

test('route: accepted passes the terms gate and reaches the normal flow', async () => {
  calls.firestore = 0;
  calls.cms = 0;
  const res = await post({ termsAccepted: true, ...CURRENT_TERMS_VERSIONS });
  assert.ok(calls.firestore + calls.cms > 0, 'the normal flow ran after the gate');
  const body = await res.json();
  assert.doesNotMatch(body.error ?? '', /accept the Terms|Terms and Conditions or the Refund/);
});

test('unit: checkTermsAcceptance accepted, missing, false and stale', () => {
  assert.deepEqual(checkTermsAcceptance({ termsAccepted: true, ...CURRENT_TERMS_VERSIONS }), { ok: true });
  assert.equal(checkTermsAcceptance({ ...CURRENT_TERMS_VERSIONS }).ok, false);
  assert.equal(checkTermsAcceptance({ termsAccepted: false, ...CURRENT_TERMS_VERSIONS }).ok, false);
  assert.equal(checkTermsAcceptance({ termsAccepted: true }).ok, false);
  assert.equal(
    checkTermsAcceptance({ termsAccepted: true, termsVersion: 'x', refundPolicyVersion: 'y' }).ok,
    false,
  );
});

const baseInput = {
  orderId: 'o1',
  reference: 'ref-0',
  showId: 'nationalShow',
  lineItems: [
    { ticketType: 'day-visitor', attendeeName: 'A', attendeeEmail: 'a@example.invalid', amount: 100, bookingRef: 'ref-0', chosenDay: null },
  ],
  idempotencyKey: 'k',
  expiresAt: realFirestore.Timestamp.fromMillis(2),
  recoveryToken: 't',
  recoveryTokenExpiresAt: realFirestore.Timestamp.fromMillis(3),
  now: realFirestore.Timestamp.fromMillis(1),
  gateway: 'ozow',
  ozowSandboxTestMode: true,
  expectedGatewayAmount: 0.01,
};

test('unit: the order stamps acceptance time and versions, no undefined own-properties', () => {
  const at = realFirestore.Timestamp.fromMillis(1);
  const { order } = buildMultiReservationDocs({
    ...baseInput,
    terms: { termsAcceptedAt: at, ...CURRENT_TERMS_VERSIONS },
  });
  assert.equal(order.termsAcceptedAt, at);
  assert.equal(order.termsVersion, CURRENT_TERMS_VERSIONS.termsVersion);
  assert.equal(order.refundPolicyVersion, CURRENT_TERMS_VERSIONS.refundPolicyVersion);
  assert.deepEqual(Object.entries(order).filter(([, v]) => v === undefined), []);
});

test('unit: a caller with no acceptance gets nulls, never undefined', () => {
  const { order } = buildMultiReservationDocs(baseInput);
  assert.equal(order.termsAcceptedAt, null);
  assert.equal(order.termsVersion, null);
  assert.equal(order.refundPolicyVersion, null);
});
