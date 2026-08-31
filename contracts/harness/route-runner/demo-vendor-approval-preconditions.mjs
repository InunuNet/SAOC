#!/usr/bin/env node
// Behavioural demonstration of the M4 "redemption preconditions" fix, mission
// vendor-gated-registration-flow. Executes the REAL route handlers --
//   app/api/admin/vendors/applications/[id]/review/route.ts
//   app/api/admin/vendors/applications/[id]/reissue-code/route.ts
//   app/api/vendors/register/verify-code/route.ts
// -- with only infrastructure (admin session, Firestore, mailer, cookie jar) replaced by the
// in-process fixtures in this directory. See README.md for how and why this works.
//
// NOT wired into the contract -- promoting these scenarios into real assertions is @architect's
// call. This file exists so the demonstration is reproducible rather than a one-off transcript.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/harness/route-runner/demo-vendor-approval-preconditions.mjs

import { createRequire } from 'node:module';

// Loaded through the SAME require() the preload interceptor hands to the route modules, so the
// harness and the routes share one instance of each fixture (an ESM import here would create a
// second, separate module instance under tsx's loader).
const require = createRequire(import.meta.url);
const { applications } = require('./store.mjs');
const { sentEmails } = require('./fixture-approval-email.mjs');
const { cookieJar } = require('./fixture-next-headers.mjs');

const REVIEW = '../../../app/api/admin/vendors/applications/[id]/review/route.ts';
const REISSUE = '../../../app/api/admin/vendors/applications/[id]/reissue-code/route.ts';
const VERIFY = '../../../app/api/vendors/register/verify-code/route.ts';

const TEST_SECRET = 'test-secret-not-a-real-credential';

const { POST: reviewPost } = await import(REVIEW);
const { POST: reissuePost } = await import(REISSUE);
const { POST: verifyPost } = await import(VERIFY);

function seed(id, businessName, overrides = {}) {
  applications.clear();
  applications.set(id, {
    status: 'pending',
    businessName,
    contactPersonName: 'Jane Vendor',
    contactEmail: 'jane@example.com',
    ...overrides,
  });
  sentEmails.length = 0;
}

async function approve(id) {
  const res = await reviewPost({ json: async () => ({ action: 'approve' }) }, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

async function reissue(id) {
  const res = await reissuePost({}, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

async function verify(businessName, codeId, forwardedFor) {
  const res = await verifyPost({
    json: async () => ({ businessName, codeId }),
    headers: new Headers({ 'x-forwarded-for': forwardedFor }),
  });
  return { status: res.status, body: await res.json() };
}

function report(label, result, id) {
  const stored = applications.get(id);
  console.log(`\n--- ${label} ---`);
  console.log(`HTTP ${result.status} ${JSON.stringify(result.body)}`);
  console.log(`stored status: ${stored.status}`);
  console.log(`stored registrationCodeId: ${JSON.stringify(stored.registrationCodeId ?? null)}`);
  console.log(`stored registrationCodeNameSlug: ${JSON.stringify(stored.registrationCodeNameSlug ?? null)}`);
  console.log(`stored registrationCodeGeneration: ${JSON.stringify(stored.registrationCodeGeneration ?? null)}`);
  console.log(`stored registrationCodeLockedAt: ${JSON.stringify(stored.registrationCodeLockedAt ?? null)}`);
  console.log(`approval emails sent: ${sentEmails.length}`);
}

// === APPROVAL =================================================================================

delete process.env.VENDOR_REGISTRATION_TOKEN_SECRET;
seed('app-a', 'Fynbos Pottery');
report('A: approve with VENDOR_REGISTRATION_TOKEN_SECRET unset', await approve('app-a'), 'app-a');

process.env.VENDOR_REGISTRATION_TOKEN_SECRET = TEST_SECRET;
seed('app-b', '太陽 陶芸');
report('B: approve with a business name that normalises to an empty slug', await approve('app-b'), 'app-b');

seed('app-c', 'Fynbos Pottery');
report('C: approve with the secret set and a usable name', await approve('app-c'), 'app-c');
const emailedCode = sentEmails[0]?.registrationCode;
console.log(`emailed registrationCode: ${JSON.stringify(emailedCode)}`);
const verifiedC = await verify('Fynbos Pottery', emailedCode, '203.0.113.9');
console.log(`verify-code HTTP ${verifiedC.status} ${JSON.stringify(verifiedC.body)}`);
console.log(`session cookie set: ${cookieJar.has('vendor_registration_session')}`);

// === REISSUE ==================================================================================
// Seeded directly as an already-approved, locked-out application -- exactly the state an
// operator reaches for reissue in, and (for D and E) one approved before the approval-route
// preconditions existed.

const APPROVED_AND_LOCKED = {
  status: 'approved',
  registrationCodeId: '1111',
  registrationCodeNameSlug: 'fynbospottery',
  registrationCodeExpiresAt: { toDate: () => new Date(Date.now() + 86_400_000) },
  registrationCodeFailedAttempts: 5,
  registrationCodeLockedAt: { toDate: () => new Date() },
  registrationCodeGeneration: 3,
};

delete process.env.VENDOR_REGISTRATION_TOKEN_SECRET;
seed('app-d', 'Fynbos Pottery', APPROVED_AND_LOCKED);
report('D: reissue with VENDOR_REGISTRATION_TOKEN_SECRET unset', await reissue('app-d'), 'app-d');

process.env.VENDOR_REGISTRATION_TOKEN_SECRET = TEST_SECRET;
seed('app-e', '太陽 陶芸', { ...APPROVED_AND_LOCKED, registrationCodeNameSlug: '' });
report('E: reissue with a business name that normalises to an empty slug', await reissue('app-e'), 'app-e');

seed('app-f', 'Fynbos Pottery', APPROVED_AND_LOCKED);
const reissuedF = await reissue('app-f');
report('F: reissue with the secret set and a usable name', reissuedF, 'app-f');
cookieJar.clear();
const verifiedF = await verify('Fynbos Pottery', reissuedF.body.registrationCodeId, '203.0.113.11');
console.log(`verify-code with the reissued code: HTTP ${verifiedF.status} ${JSON.stringify(verifiedF.body)}`);
console.log(`session cookie set: ${cookieJar.has('vendor_registration_session')}`);
const verifiedOldF = await verify('Fynbos Pottery', '1111', '203.0.113.12');
console.log(`verify-code with the SUPERSEDED code "1111": HTTP ${verifiedOldF.status} ${JSON.stringify(verifiedOldF.body)}`);
