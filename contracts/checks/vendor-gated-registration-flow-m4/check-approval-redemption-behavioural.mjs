#!/usr/bin/env node
// vendor-gated-registration-flow M4/F24 -- BEHAVIOURAL proof, using the route-runner harness
// (contracts/harness/route-runner/), that approval never commits an application into a state
// the vendor cannot actually redeem. Adapted from
// contracts/harness/route-runner/demo-vendor-approval-preconditions.mjs's scenarios A/B/C into
// real pass/fail assertions.
//
// WHY THIS EXISTS, TOLD PLAINLY: check-approval-mints-code-atomically.mjs (this mission's
// original A50) asserted "generateVendorRegistrationCodeId() precedes ref.update()" -- a
// SOURCE-ORDER proof, written when running the real route was believed impossible in this
// environment. It stayed GREEN when Codex found that F24 moved the vendor's actual redemption
// dependency (VENDOR_REGISTRATION_TOKEN_SECRET, read by POST /api/vendors/register/verify-code
// to mint the session cookie) to a different file, with nothing re-checking it at the approval
// route's point of no return -- because a source-order check can only see the shape it was
// written to look for, never a precondition that migrated somewhere else. The route-runner
// harness (see its README "Why this exists") makes that limitation obsolete: it runs the REAL
// route handlers with only infrastructure faked. This check exercises the REAL
// POST /api/admin/vendors/applications/[id]/review AND, on a successful approval, the REAL
// POST /api/vendors/register/verify-code with the code the approval route actually emailed --
// so it is impossible for this check to pass while the vendor cannot actually redeem the
// credential, regardless of which file the precondition that would prevent that lives in.
//
// Covers BOTH defects Codex found in the same mechanism (the team lead's items 1 and 2):
//   (1) VENDOR_REGISTRATION_TOKEN_SECRET unset at approval time.
//   (2) a business name that normalises to an empty registrationCodeNameSlug.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-gated-registration-flow-m4/check-approval-redemption-behavioural.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { applications } = require('../../../contracts/harness/route-runner/store.mjs');
const { sentEmails } = require('../../../contracts/harness/route-runner/fixture-approval-email.mjs');
const { cookieJar } = require('../../../contracts/harness/route-runner/fixture-next-headers.mjs');

const REVIEW = '../../../app/api/admin/vendors/applications/[id]/review/route.ts';
const VERIFY = '../../../app/api/vendors/register/verify-code/route.ts';

const TEST_SECRET = 'test-secret-not-a-real-credential';
const failures = [];

const { POST: reviewPost } = await import(REVIEW);
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
  cookieJar.clear();
}

async function approve(id) {
  const res = await reviewPost({ json: async () => ({ action: 'approve' }) }, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

async function verify(businessName, codeId, forwardedFor) {
  const res = await verifyPost({
    json: async () => ({ businessName, codeId }),
    headers: new Headers({ 'x-forwarded-for': forwardedFor }),
  });
  return { status: res.status, body: await res.json() };
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

// -------------------------------------------------------------------------------------------
// A: VENDOR_REGISTRATION_TOKEN_SECRET unset -- approval must refuse, application stays pending,
// no code, no email. This is the exact defect Codex found: without this, the OLD behaviour was
// a 200, an emailed code, and a permanently unredeemable credential.
// -------------------------------------------------------------------------------------------
{
  delete process.env.VENDOR_REGISTRATION_TOKEN_SECRET;
  seed('app-a', 'Fynbos Pottery');
  const result = await approve('app-a');
  const stored = applications.get('app-a');

  check(result.status !== 200, `A (missing secret): approval returned HTTP ${result.status}, expected a refusal (non-200).`);
  check(stored.status === 'pending', `A (missing secret): application status is "${stored.status}", expected it to remain "pending".`);
  check(!stored.registrationCodeId, `A (missing secret): a registrationCodeId (${JSON.stringify(stored.registrationCodeId)}) was committed despite the missing secret.`);
  check(sentEmails.length === 0, `A (missing secret): ${sentEmails.length} approval email(s) were sent despite the refused approval.`);
}

// -------------------------------------------------------------------------------------------
// B: a business name that normalises to an empty registrationCodeNameSlug (entirely non-Latin
// script or punctuation) -- approval must refuse the same way, for the same reason: the
// verify-time equality lookup on this slug could never match any realistic typed input. Not
// hypothetical in this project's context (South African vendor names).
// -------------------------------------------------------------------------------------------
{
  process.env.VENDOR_REGISTRATION_TOKEN_SECRET = TEST_SECRET;
  seed('app-b', '太陽 陶芸'); // normalises to '' -- no [a-z0-9] characters at all
  const result = await approve('app-b');
  const stored = applications.get('app-b');

  check(result.status !== 200, `B (empty slug): approval returned HTTP ${result.status}, expected a refusal (non-200).`);
  check(stored.status === 'pending', `B (empty slug): application status is "${stored.status}", expected it to remain "pending".`);
  check(!stored.registrationCodeId, `B (empty slug): a registrationCodeId (${JSON.stringify(stored.registrationCodeId)}) was committed despite the unmatchable slug.`);
  check(sentEmails.length === 0, `B (empty slug): ${sentEmails.length} approval email(s) were sent despite the refused approval.`);
}

// -------------------------------------------------------------------------------------------
// C: the positive control -- with the secret set and a usable name, approval succeeds AND the
// exact code it emailed genuinely verifies at the real verify-code route, minting a real
// session cookie. Without this arm, A and B could pass by a check that refuses EVERY approval
// (a check that always says no is not a check for these two preconditions specifically) --
// this proves the checks in A/B are actually gating on the condition, not vacuously refusing.
// -------------------------------------------------------------------------------------------
{
  process.env.VENDOR_REGISTRATION_TOKEN_SECRET = TEST_SECRET;
  seed('app-c', 'Fynbos Pottery');
  const result = await approve('app-c');
  const stored = applications.get('app-c');

  check(result.status === 200, `C (positive control): approval with a valid secret and usable name returned HTTP ${result.status}, expected 200.`);
  check(stored.status === 'approved', `C (positive control): application status is "${stored.status}", expected "approved".`);
  check(typeof stored.registrationCodeId === 'string' && stored.registrationCodeId.length > 0, 'C (positive control): no registrationCodeId was committed on a successful approval.');
  check(sentEmails.length === 1, `C (positive control): expected exactly 1 approval email, got ${sentEmails.length}.`);

  const emailedCode = sentEmails[0]?.registrationCode;
  check(typeof emailedCode === 'string' && emailedCode.length > 0, 'C (positive control): the approval email did not carry a registrationCode.');

  if (emailedCode) {
    const verified = await verify('Fynbos Pottery', emailedCode, '203.0.113.9');
    check(verified.status === 200, `C (positive control): verify-code with the EMAILED code returned HTTP ${verified.status} ${JSON.stringify(verified.body)}, expected 200 -- the credential this approval issued does not actually redeem.`);
    check(cookieJar.has('vendor_registration_session'), 'C (positive control): a successful verify-code did not set the session cookie.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS (behavioural, real routes via the route-runner harness): approval refuses to commit -- ' +
    'application stays pending, no code, no email -- when VENDOR_REGISTRATION_TOKEN_SECRET is ' +
    'unset OR the business name normalises to an empty slug, and (positive control) a normal ' +
    'approval both succeeds AND the exact code it emails genuinely redeems at the real ' +
    'POST /api/vendors/register/verify-code route, minting a real session cookie.',
);
process.exit(0);
