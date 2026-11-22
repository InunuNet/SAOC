// Public-endpoint hardening: route behaviour around the streamed body cap.
//
// - checkout answers a missing Idempotency-Key with its 400 without reading the body, however
//   large or endless the body is (nothing answered unread on main may read first);
// - a one-click unsubscribe whose stream errors is handled, not thrown;
// - a JSON `null` body is the route's own 400 on checkout and both vendor upload routes, while
//   `[]` and a scalar fall through to each route's field validation exactly as on main.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/public-endpoint-hardening/check-streamed-body-cap-routes.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';

import { NextRequest } from 'next/server';

const realFirestore = await import('firebase-admin/firestore');
const realStorage = await import('firebase-admin/storage');
const realSanityClient = await import('../../../sanity/lib/client.ts');

const fakeDb = {
  collection: () => ({
    doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }),
    where: () => ({ get: async () => ({ empty: true, docs: [] }) }),
    get: async () => ({ empty: true, docs: [] }),
  }),
  runTransaction: async (run) => run({}),
};
mock.module('firebase-admin/firestore', {
  exports: { ...realFirestore, getFirestore: () => fakeDb },
});
mock.module('firebase-admin/storage', {
  exports: { ...realStorage, getStorage: () => ({ bucket: () => ({}) }) },
});
mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => ({}), getStorageBucketName: () => 'test-bucket' },
});
mock.module(new URL('../../../sanity/lib/client.ts', import.meta.url).href, {
  exports: {
    ...realSanityClient,
    client: { fetch: async () => { throw new Error('cms unavailable in test'); } },
  },
});

const { planMarketingAssetUpload } = await import('../../../lib/vendor-marketing-upload.ts');
const { planProofOfPaymentUpload } = await import('../../../lib/vendor-payment.ts');
const checkout = await import('../../../app/api/tickets/checkout/route.ts');
const unsubscribe = await import('../../../app/api/newsletter/unsubscribe/route.ts');
const marketing = await import('../../../app/api/vendors/[id]/marketing-asset/route.ts');
const proof = await import('../../../app/api/vendors/[id]/proof-of-payment/route.ts');

const KEY = '3f2b8c1e-9d4a-4e6b-8a57-bbbbbbbbbbbb';
const REAL_ID = 'aB3dE5gH7jK9mN1pQ3rS';
const encoder = new TextEncoder();
let ipCounter = 0;
const freshIp = () => `203.0.113.${++ipCounter}`;

function lazyStream(pullChunk) {
  const state = { pulls: 0 };
  const stream = new ReadableStream(
    {
      pull(controller) {
        state.pulls += 1;
        pullChunk(controller, state.pulls);
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, state };
}

function request(url, headers, body) {
  return new NextRequest(url, { method: 'POST', headers, body, duplex: 'half' });
}

test('checkout: a missing Idempotency-Key is a 400 before any of an endless body is read', async () => {
  const { stream, state } = lazyStream((controller) => controller.enqueue(encoder.encode('x'.repeat(1024))));
  const res = await checkout.POST(
    request('http://localhost/api/tickets/checkout', { 'x-forwarded-for': freshIp() }, stream),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'A valid UUID Idempotency-Key header is required.' });
  assert.equal(state.pulls, 0, 'the body was read');
});

test('checkout: an invalid key with an oversize body and a lying Content-Length is still the key 400', async () => {
  const body = 'x'.repeat(200 * 1024);
  const res = await checkout.POST(
    request(
      'http://localhost/api/tickets/checkout',
      { 'x-forwarded-for': freshIp(), 'idempotency-key': 'not-a-uuid', 'content-length': '10' },
      body,
    ),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'A valid UUID Idempotency-Key header is required.' });
});

test('checkout: a valid key with an oversize streamed body is the 413', async () => {
  const { stream } = lazyStream((controller) => controller.enqueue(encoder.encode('x'.repeat(65536))));
  const res = await checkout.POST(
    request(
      'http://localhost/api/tickets/checkout',
      { 'x-forwarded-for': freshIp(), 'idempotency-key': KEY },
      stream,
    ),
  );
  assert.equal(res.status, 413);
  assert.deepEqual(await res.json(), { error: 'Request body too large.' });
});

test('unsubscribe: a one-click form whose stream errors is handled, not thrown', async () => {
  const { stream } = lazyStream((controller) => controller.error(new Error('connection reset')));
  const res = await unsubscribe.POST(
    request(
      'http://localhost/api/newsletter/unsubscribe',
      { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': freshIp() },
      stream,
    ),
  );
  assert.equal(res.status, 400);
});

test('unsubscribe: an oversize one-click form is the 413', async () => {
  const res = await unsubscribe.POST(
    request(
      'http://localhost/api/newsletter/unsubscribe',
      { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '10' },
      'x'.repeat(8192),
    ),
  );
  assert.equal(res.status, 413);
});

const INVALID_BODY = { error: 'Invalid request body.' };

async function call(post, url, headers, body, id) {
  return post(
    request(url, { ...headers, 'content-type': 'application/json' }, body),
    id ? { params: Promise.resolve({ id }) } : undefined,
  );
}

const checkoutUrl = 'http://localhost/api/tickets/checkout';
const marketingUrl = `http://localhost/api/vendors/${REAL_ID}/marketing-asset`;
const proofUrl = `http://localhost/api/vendors/${REAL_ID}/proof-of-payment`;
const checkoutHeaders = () => ({ 'x-forwarded-for': freshIp(), 'idempotency-key': KEY });
const uploadHeaders = () => ({ 'x-forwarded-for': freshIp() });

test('a JSON null body is the route own 400 on checkout and both vendor uploads', async () => {
  for (const [post, url, headers, id] of [
    [checkout.POST, checkoutUrl, checkoutHeaders(), undefined],
    [marketing.POST, marketingUrl, uploadHeaders(), REAL_ID],
    [proof.POST, proofUrl, uploadHeaders(), REAL_ID],
  ]) {
    const res = await call(post, url, headers, 'null', id);
    assert.equal(res.status, 400, url);
    assert.deepEqual(await res.json(), INVALID_BODY, url);
  }
});

test('checkout: [] and 7 fall through to the field validation, as on main', async () => {
  const source = readFileSync(new URL('../../../app/api/tickets/checkout/route.ts', import.meta.url), 'utf8');
  const expected = /error: '(showId, lineItems[^']+)'/.exec(source)?.[1];
  assert.ok(expected, 'field-validation message not found in the route source');
  for (const body of ['[]', '7']) {
    const res = await call(checkout.POST, checkoutUrl, checkoutHeaders(), body);
    assert.equal(res.status, 400, body);
    assert.deepEqual(await res.json(), { error: expected }, body);
  }
});

test('vendor uploads: [] and 7 fall through to the handler field validation, as on main', async () => {
  // The routes default every non-string field to '' (and sizeBytes to -1) before the handler.
  const cases = [
    [marketing.POST, marketingUrl, planMarketingAssetUpload({
      submissionId: REAL_ID, assetSlot: '', fileName: '', mimeType: '', sizeBytes: -1,
    })],
    [proof.POST, proofUrl, planProofOfPaymentUpload({
      submissionId: REAL_ID, fileName: '', mimeType: '', sizeBytes: -1,
    })],
  ];
  for (const [post, url, plan] of cases) {
    assert.equal(plan.ok, false, 'the empty input must be a validation failure');
    for (const body of ['[]', '7']) {
      const res = await call(post, url, uploadHeaders(), body, REAL_ID);
      assert.equal(res.status, 400, `${url} ${body}`);
      assert.deepEqual(await res.json(), { error: plan.error }, `${url} ${body}`);
      assert.notEqual(plan.error, INVALID_BODY.error);
    }
  }
});
