#!/usr/bin/env node
// Vendor upload routes call getStorage(initAdmin()).bucket() with no name, which only works if
// initAdmin() gave the Admin app a storageBucket. Proves, against the real lib/firebase-admin.ts
// and the real firebase-admin SDK (no network -- initializeApp never contacts Google):
//   1. NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET set   -> app.options.storageBucket carries it.
//   2. NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET unset -> initAdmin() still succeeds (Firestore-only
//      routes keep working) and storageBucket is absent; getStorageBucketName() is undefined.
//
// Run as: node contracts/checks/vendor-storage-bucket/check-init-admin-storage-bucket.mjs

import { generateKeyPairSync } from 'node:crypto';

import { deleteApp, getApps } from 'firebase-admin/app';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

process.env.FIREBASE_ADMIN_PROJECT_ID = 'fixture-project';
process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'fixture@fixture-project.iam.gserviceaccount.com';
process.env.FIREBASE_ADMIN_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');

const { initAdmin, getStorageBucketName } = await import('../../../lib/firebase-admin.ts');

const FIXTURE_BUCKET = 'fixture-project.firebasestorage.app';
const failures = [];

async function resetApps() {
  await Promise.all(getApps().map((app) => deleteApp(app)));
}

process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = FIXTURE_BUCKET;
const withBucket = initAdmin();
if (withBucket.options.storageBucket !== FIXTURE_BUCKET) {
  failures.push(
    `env set: expected storageBucket "${FIXTURE_BUCKET}", got "${withBucket.options.storageBucket}".`,
  );
}
if (getStorageBucketName() !== FIXTURE_BUCKET) {
  failures.push('env set: getStorageBucketName() did not return the configured bucket.');
}
await resetApps();

delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
let withoutBucket;
try {
  withoutBucket = initAdmin();
} catch (err) {
  failures.push(`env unset: initAdmin() threw (${err instanceof Error ? err.message : err}).`);
}
if (withoutBucket && 'storageBucket' in withoutBucket.options) {
  failures.push('env unset: storageBucket key present on app options; expected it omitted.');
}
if (getStorageBucketName() !== undefined) {
  failures.push('env unset: getStorageBucketName() should be undefined.');
}
await resetApps();

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('PASS: initAdmin passes storageBucket when env set, omits it when unset.');
