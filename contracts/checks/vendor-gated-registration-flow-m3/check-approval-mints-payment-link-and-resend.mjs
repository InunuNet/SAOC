#!/usr/bin/env node
// vendor-gated-registration-flow M3/F28 (A57) -- behavioural proof, via the route-runner
// harness, that approving a submission mints + emails a stand-payment link as a NON-fatal
// post-commit step (unlike M1's fail-closed application-token mint -- see the golden README's
// "Approval triggers the mint"), and that the resend escape hatch mints fresh and refuses
// against a non-approved or already-paid submission.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-gated-registration-flow-m3/check-approval-mints-payment-link-and-resend.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require(
  '../../harness/route-runner/store.mjs',
);
const { sentStandPaymentEmails } = require('../../harness/route-runner/fixture-vendor-stand-payment-notice.mjs');

const REVIEW = '../../../app/api/admin/vendors/[id]/review/route.ts';
const RESEND = '../../../app/api/admin/vendors/[id]/resend-payment-link/route.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const { POST: reviewPost } = await import(REVIEW);
const { POST: resendPost } = await import(RESEND);
const { verifyVendorStandPaymentToken } = await import(TOKEN);

const TEST_SECRET = 'test-stand-payment-secret-not-real';

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

function seed(id, overrides = {}) {
  vendorSubmissions.set(id, {
    status: 'under-review',
    businessName: 'Fynbos Pottery',
    contactPersonName: 'Jane Vendor',
    contactEmail: 'jane@example.com',
    ...overrides,
  });
}

async function callReview(id, action) {
  const res = await reviewPost({ json: async () => ({ action }) }, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

async function callResend(id) {
  const res = await resendPost({}, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

function tokenFromLastEmail() {
  const url = sentStandPaymentEmails.at(-1)?.paymentUrl ?? '';
  return new URL(url).searchParams.get('token');
}

// --- Secret UNSET: approval still commits, no stand-payment email sent, no throw --------------
resetAllCollections();
delete process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
sentStandPaymentEmails.length = 0;
seed('sub-no-secret');
const approveNoSecret = await callReview('sub-no-secret', 'approve');
assert(
  approveNoSecret.status === 200 && approveNoSecret.body.status === 'approved',
  `expected approval to commit even with the payment-token secret unset, got ${approveNoSecret.status} ${JSON.stringify(approveNoSecret.body)}`,
);
assert(
  vendorSubmissions.get('sub-no-secret')?.status === 'approved',
  'the submission document should be status "approved" even when the payment-token secret is unset.',
);
assert(sentStandPaymentEmails.length === 0, 'no stand-payment email should be sent when the secret is unset.');

// --- Secret SET: approval sends a real, verifiable payment-link email -------------------------
resetAllCollections();
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;
sentStandPaymentEmails.length = 0;
seed('sub-with-secret');
const approveWithSecret = await callReview('sub-with-secret', 'approve');
assert(approveWithSecret.status === 200, `expected approval to commit, got ${approveWithSecret.status}`);
assert(sentStandPaymentEmails.length === 1, `expected exactly one stand-payment email, got ${sentStandPaymentEmails.length}`);
const mintedToken = tokenFromLastEmail();
const mintedVerification = verifyVendorStandPaymentToken({ token: mintedToken, secret: TEST_SECRET, now: new Date() });
assert(
  mintedVerification.ok === true && mintedVerification.vendorSubmissionId === 'sub-with-secret',
  `the emailed token should verify and resolve to the approved submission, got ${JSON.stringify(mintedVerification)}`,
);

// --- Resend refuses against a non-approved submission ------------------------------------------
seed('sub-not-approved', { status: 'submitted' });
const resendNotApproved = await callResend('sub-not-approved');
assert(resendNotApproved.status === 409, `expected resend against a non-approved submission to be refused 409, got ${resendNotApproved.status}`);

// --- Resend against an approved, unpaid submission mints a FRESH token ------------------------
sentStandPaymentEmails.length = 0;
const resendFresh = await callResend('sub-with-secret');
assert(resendFresh.status === 200, `expected resend to succeed against an approved, unpaid submission, got ${resendFresh.status}`);
assert(sentStandPaymentEmails.length === 1, 'resend should send exactly one new email.');
const resentToken = tokenFromLastEmail();
assert(
  resentToken !== mintedToken,
  'resend produced the SAME token bytes as the original approval mint -- it must always mint fresh, never re-read a cached value ("reissue, not unlock").',
);
const resentVerification = verifyVendorStandPaymentToken({ token: resentToken, secret: TEST_SECRET, now: new Date() });
assert(resentVerification.ok === true, 'the resent token should itself verify.');

// --- Resend refuses once the stand order is already paid ---------------------------------------
vendorStandOrders.set('sub-with-secret', { status: 'paid' });
sentStandPaymentEmails.length = 0;
const resendAfterPaid = await callResend('sub-with-secret');
assert(resendAfterPaid.status === 409, `expected resend against an already-paid stand order to be refused 409, got ${resendAfterPaid.status}`);
assert(sentStandPaymentEmails.length === 0, 'no email should be sent when resend is refused for an already-paid stand.');

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: approval commits regardless of the payment-token secret\'s presence (non-fatal by ' +
    'design), sends exactly one verifiable payment-link email when the secret is set, and the ' +
    'resend escape hatch always mints a fresh, byte-distinct token while correctly refusing a ' +
    'non-approved or already-paid submission.',
);
process.exit(0);
