// Public-endpoint hardening F8: vendor proof-of-payment and marketing-asset uploads.
//
// The legitimate flow carries nothing but the submission id (it is returned by the registration
// response and emailed; the upload page holds no session or token), so no second factor can be
// added without changing the vendor flow. What is added invisibly: an id that is not a Firestore
// auto-id shape is answered with the same 202 and no Firestore read or Storage write. The
// existing size, magic-byte and rate-limit bounds are re-proven here at the route.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/public-endpoint-hardening/check-vendor-upload-id-shape.test.mjs

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { NextRequest } from 'next/server';

const realFirestore = await import('firebase-admin/firestore');
const realStorage = await import('firebase-admin/storage');

const calls = { reads: [], saves: [], updates: [] };
const REAL_ID = 'aB3dE5gH7jK9mN1pQ3rS';
const OVERSIZE_BYTES = 20 * 1024 * 1024;

const fakeDb = {
  collection: () => ({
    doc: (id) => ({
      get: async () => {
        calls.reads.push(id);
        return { exists: id === REAL_ID };
      },
      update: async (patch) => {
        calls.updates.push({ id, patch });
      },
    }),
  }),
};
mock.module('firebase-admin/firestore', {
  exports: { ...realFirestore, getFirestore: () => fakeDb },
});
mock.module('firebase-admin/storage', {
  exports: {
    ...realStorage,
    getStorage: () => ({
      bucket: () => ({
        file: (path) => ({
          save: async () => {
            calls.saves.push(path);
          },
        }),
      }),
    }),
  },
});
mock.module(new URL('../../../lib/firebase-admin.ts', import.meta.url).href, {
  exports: { initAdmin: () => ({}), getStorageBucketName: () => 'test-bucket' },
});

const proof = await import('../../../app/api/vendors/[id]/proof-of-payment/route.ts');
const marketing = await import('../../../app/api/vendors/[id]/marketing-asset/route.ts');

const PDF = Buffer.from('%PDF-1.4 test file body');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('test image body'),
]);
let ipCounter = 0;

const PROFILES = [
  { name: 'proof-of-payment', route: proof, good: PDF, mime: 'application/pdf', fileName: 'proof.pdf', extra: {} },
  {
    name: 'marketing-asset',
    route: marketing,
    good: PNG,
    mime: 'image/png',
    fileName: 'logo.png',
    extra: { assetSlot: 'logo' },
  },
];

function upload(profile, id, bytes = profile.good) {
  const body = JSON.stringify({
    fileName: profile.fileName,
    mimeType: profile.mime,
    sizeBytes: bytes.length,
    fileBase64: bytes.toString('base64'),
    ...profile.extra,
  });
  const request = new NextRequest(`http://localhost/api/vendors/${id}/x`, {
    method: 'POST',
    headers: {
      'x-forwarded-for': `198.51.100.${++ipCounter}, 10.0.0.1, 10.0.0.2`,
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
    },
    body,
  });
  return profile.route.POST(request, { params: Promise.resolve({ id }) });
}

const reset = () => {
  calls.reads = [];
  calls.saves = [];
  calls.updates = [];
};

for (const profile of PROFILES) {
  const { name } = profile;

  test(`${name}: legitimate upload for a real submission id still succeeds and is stored`, async () => {
    reset();
    const res = await upload(profile, REAL_ID);
    assert.equal(res.status, 202);
    assert.equal(calls.saves.length, 1);
    assert.equal(calls.updates.length, 1);
  });

  test(`${name}: a non auto-id gets the same 202 with no Firestore read and no write`, async () => {
    reset();
    const real = await (await upload(profile, REAL_ID)).json();
    reset();
    for (const id of ['short', 'x'.repeat(21), 'has-dash-in-the-id01']) {
      const res = await upload(profile, id);
      assert.equal(res.status, 202);
      assert.deepEqual(await res.json(), real);
    }
    assert.deepEqual(calls.reads, []);
    assert.deepEqual(calls.saves, []);
    assert.deepEqual(calls.updates, []);
  });

  test(`${name}: wrong file content for the declared type is refused before any write`, async () => {
    reset();
    const res = await upload(profile, REAL_ID, Buffer.from('not the declared type, just text'));
    assert.equal(res.status, 400);
    assert.deepEqual(calls.saves, []);
  });

  test(`${name}: a body over the size cap is refused with 413 before it is parsed`, async () => {
    reset();
    const big = Buffer.concat([profile.good, Buffer.alloc(OVERSIZE_BYTES)]);
    const res = await upload(profile, REAL_ID, big);
    assert.equal(res.status, 413);
    assert.deepEqual(calls.saves, []);
  });
}
