#!/usr/bin/env node
// Behavioural demonstration of M3 (vendor-gated-registration-flow) -- the stand-booking
// payment mechanism (F26-F31). Executes the REAL route handlers --
//   app/api/admin/vendors/[id]/review/route.ts
//   app/api/admin/vendors/[id]/resend-payment-link/route.ts
//   app/api/vendors/stand-payment/initiate/route.ts
//   app/api/vendors/stand-payment/payfast-itn/route.ts
//   app/api/vendors/stand-payment/ozow-itn/route.ts
// -- with only infrastructure (admin session, Firestore, mailer, gateway) replaced by the
// in-process fixtures in this directory. See README.md for how and why this works, and for
// why this file exists at all: A55-A64 (contracts/checks/vendor-gated-registration-flow-m3/)
// were not present in the repo when M3 was implemented, so this demo is the reproducible
// behavioural evidence for the money-path properties the team lead asked for directly, pending
// @architect promoting some/all of these scenarios into real contract assertions.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/harness/route-runner/demo-vendor-stand-payment.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require('./store.mjs');
const { sentStandPaymentEmails } = require('./fixture-vendor-stand-payment-notice.mjs');
const { setActiveGateway } = require('./fixture-active-gateway.mjs');
const { setReadiness, resetPaymentsFixture, initiateCalls } = require('./fixture-payments.mjs');

const REVIEW = '../../../app/api/admin/vendors/[id]/review/route.ts';
const RESEND = '../../../app/api/admin/vendors/[id]/resend-payment-link/route.ts';
const INITIATE = '../../../app/api/vendors/stand-payment/initiate/route.ts';
const PAYFAST_ITN = '../../../app/api/vendors/stand-payment/payfast-itn/route.ts';
const OZOW_ITN = '../../../app/api/vendors/stand-payment/ozow-itn/route.ts';
const PRICING = '../../../lib/vendor-stand-pricing.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const { POST: reviewPost } = await import(REVIEW);
const { POST: resendPost } = await import(RESEND);
const { POST: initiatePost } = await import(INITIATE);
const { POST: payfastItnPost } = await import(PAYFAST_ITN);
const { POST: ozowItnPost } = await import(OZOW_ITN);
const pricing = await import(PRICING);
const { verifyVendorStandPaymentToken, mintVendorStandPaymentToken } = await import(TOKEN);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;
process.env.VENDOR_REGISTRATION_TOKEN_SECRET = 'unrelated-m1-secret';

let failures = 0;
function assert(condition, label) {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${label}`);
  if (!condition) failures += 1;
}

function seedSubmission(id, overrides = {}) {
  vendorSubmissions.set(id, {
    status: 'approved',
    businessName: 'Fynbos Pottery',
    contactPersonName: 'Jane Vendor',
    contactEmail: 'jane@example.com',
    ...overrides,
  });
}

function resetPricing(values) {
  pricing.VENDOR_STAND_PRICE_ZAR[1] = values[1];
  pricing.VENDOR_STAND_PRICE_ZAR[2] = values[2];
  pricing.VENDOR_STAND_PRICE_ZAR[3] = values[3];
}

async function callReview(id, action) {
  const res = await reviewPost({ json: async () => ({ action }) }, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

async function callResend(id) {
  const res = await resendPost({}, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

async function callInitiate(token, boothSize) {
  const res = await initiatePost({ json: async () => ({ token, boothSize }) });
  return { status: res.status, body: await res.json() };
}

async function callItn(post, payload) {
  const res = await post({ text: async () => JSON.stringify(payload), headers: new Headers() });
  return { status: res.status, body: await res.json() };
}

// =============================================================================================
// A -- pricing gate flips the mechanism on nothing but the pricing constants (A55).
// =============================================================================================
console.log('\n=== A: pricing gate ===');
resetAllCollections();
resetPricing({ 1: null, 2: null, 3: null });
seedSubmission('sub-a');
const mintedA = mintToken('sub-a');
for (const boothSize of [1, 2, 3]) {
  const result = await callInitiate(mintedA, boothSize);
  assert(result.status === 503, `boothSize ${boothSize} refused 503 with prices null`);
}
assert(!vendorStandOrders.has('sub-a'), 'no vendorStandOrders doc created while prices are null');

resetPricing({ 1: 1500, 2: 2800, 3: 3900 });
const okResult = await callInitiate(mintedA, 2);
assert(okResult.status === 200, 'same request succeeds once prices are configured');
assert(vendorStandOrders.get('sub-a')?.amount === 2800, 'created order amount matches the configured price, not a body-supplied value');
assert(initiateCalls.at(-1)?.amountFormatted === '2800.00', 'provider.initiate() was called with the server-derived amount');

// =============================================================================================
// B -- approval mints + emails the payment link; resend escape hatch (A57).
// =============================================================================================
console.log('\n=== B: approval mint + resend ===');
resetAllCollections();
resetPricing({ 1: 1500, 2: 2800, 3: 3900 });
sentStandPaymentEmails.length = 0;

delete process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
seedSubmission('sub-b1', { status: 'under-review' });
const approveNoSecret = await callReview('sub-b1', 'approve');
assert(approveNoSecret.status === 200 && approveNoSecret.body.status === 'approved', 'approval commits even with VENDOR_STAND_PAYMENT_TOKEN_SECRET unset');
assert(sentStandPaymentEmails.length === 0, 'no stand-payment email sent when the secret is unset');

process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;
seedSubmission('sub-b2', { status: 'under-review' });
sentStandPaymentEmails.length = 0;
const approveWithSecret = await callReview('sub-b2', 'approve');
assert(approveWithSecret.status === 200, 'approval commits with the secret set');
assert(sentStandPaymentEmails.length === 1, 'exactly one stand-payment email sent when the secret is set');
const emailedUrl = sentStandPaymentEmails[0]?.paymentUrl ?? '';
const emailedToken = new URL(emailedUrl).searchParams.get('token');
const emailedVerified = verifyVendorStandPaymentToken({ token: emailedToken, secret: TEST_SECRET, now: new Date() });
assert(emailedVerified.ok && emailedVerified.vendorSubmissionId === 'sub-b2', 'the emailed token verifies and resolves to the right submission');

seedSubmission('sub-b3', { status: 'submitted' });
const resendRefused = await callResend('sub-b3');
assert(resendRefused.status === 409, 'resend refused against a non-approved submission');

sentStandPaymentEmails.length = 0;
const resendFresh = await callResend('sub-b2');
assert(resendFresh.status === 200, 'resend succeeds against an approved, unpaid submission');
const resentToken = new URL(sentStandPaymentEmails[0].paymentUrl).searchParams.get('token');
assert(resentToken !== emailedToken, 'resend mints a FRESH token, not the same bytes as the approval mint');

vendorStandOrders.set('sub-b2', { status: 'paid' });
const resendAfterPaid = await callResend('sub-b2');
assert(resendAfterPaid.status === 409, 'resend refused once the stand order is already paid');

// =============================================================================================
// C -- token is state-gated, not a mint-time snapshot (A62).
// =============================================================================================
console.log('\n=== C: token state-gated, not snapshot ===');
resetAllCollections();
resetPricing({ 1: 1500, 2: 2800, 3: 3900 });
seedSubmission('sub-c');
const mintedC = mintToken('sub-c');
vendorSubmissions.set('sub-c', { ...vendorSubmissions.get('sub-c'), status: 'rejected' });
const afterRejected = await callInitiate(mintedC, 1);
assert(afterRejected.status === 403, 'a token minted while approved is refused once the submission is no longer approved');

seedSubmission('sub-c2');
const mintedC2 = mintToken('sub-c2');
vendorStandOrders.set('sub-c2', { status: 'paid' });
const afterPaid = await callInitiate(mintedC2, 1);
assert(afterPaid.status === 409, 'a token for an already-paid stand is refused with a DISTINCT ("already paid") message, not the generic token message');
assert(afterPaid.body.error !== afterRejected.body.error, 'the two refusal classes use genuinely different messages');

// =============================================================================================
// D -- initiate is transactionally idempotent (A60).
// =============================================================================================
console.log('\n=== D: initiate transactional idempotency ===');
resetAllCollections();
resetPaymentsFixture();
resetPricing({ 1: 1500, 2: 2800, 3: 3900 });
seedSubmission('sub-d');
const mintedD = mintToken('sub-d');

const [first, second] = await Promise.all([callInitiate(mintedD, 1), callInitiate(mintedD, 1)]);
assert(first.status === 200 && second.status === 200, 'two concurrent initiate calls for the same submission both succeed (no unhandled collision)');
assert(vendorStandOrders.size === 1, 'exactly ONE vendorStandOrders document exists after two concurrent initiate calls');

const retry = await callInitiate(mintedD, 3);
assert(retry.status === 200, 'a later retry with a different boothSize succeeds');
assert(vendorStandOrders.size === 1, 'the retry overwrote the SAME document rather than creating a second one');
assert(vendorStandOrders.get('sub-d').boothSize === 3 && vendorStandOrders.get('sub-d').amount === 3900, 'the retry overwrote boothSize/amount/standOrderRef on the same doc');

// Settle it, then attempt a post-payment initiate.
vendorStandOrders.set('sub-d', { ...vendorStandOrders.get('sub-d'), status: 'paid', gateway: 'payfast' });
const paidSnapshotBefore = JSON.stringify(vendorStandOrders.get('sub-d'));
const postPaidInitiate = await callInitiate(mintedD, 1);
assert(postPaidInitiate.status === 409, 'an initiate call after payment is refused');
assert(JSON.stringify(vendorStandOrders.get('sub-d')) === paidSnapshotBefore, 'the paid document is left byte-identical after the refused call');

// =============================================================================================
// E -- settlement: idempotent, amount-guarded, cross-gateway-guarded (A61).
// =============================================================================================
console.log('\n=== E: settlement idempotency + guards ===');
resetAllCollections();
resetPaymentsFixture();
resetPricing({ 1: 1500, 2: 2800, 3: 3900 });
seedSubmission('sub-e');
setActiveGateway('payfast');
setReadiness({ ready: true });
const mintedE = mintToken('sub-e');
await callInitiate(mintedE, 1); // creates a 'pending' order for 1500, gateway 'payfast'

const paidNotification = { reference: 'VSO-sub-e', rawStatus: 'paid', grossAmountCents: 150000, gatewayPaymentId: 'pf-1' };
const settle1 = await callItn(payfastItnPost, paidNotification);
assert(settle1.status === 200, 'first settlement notification acknowledged');
assert(vendorStandOrders.get('sub-e').status === 'paid', 'order flips to paid on first settlement');
assert(vendorSubmissions.get('sub-e').paymentReceived === true, 'vendorSubmissions.paymentReceived flips true in the SAME settlement');

const orderSnapshotAfterFirst = JSON.stringify(vendorStandOrders.get('sub-e'));
const settle2 = await callItn(payfastItnPost, paidNotification);
assert(settle2.status === 200, 'duplicate settlement notification acknowledged (200, gateway stops retrying)');
assert(JSON.stringify(vendorStandOrders.get('sub-e')) === orderSnapshotAfterFirst, 'duplicate notification produced ZERO additional writes -- order document is byte-identical');

// Tampered amount, fresh pending order.
resetAllCollections();
resetPricing({ 1: 1500, 2: 2800, 3: 3900 });
seedSubmission('sub-e2');
const mintedE2 = mintToken('sub-e2');
await callInitiate(mintedE2, 1);
const tampered = { reference: 'VSO-sub-e2', rawStatus: 'paid', grossAmountCents: 1, gatewayPaymentId: 'pf-2' };
await callItn(payfastItnPost, tampered);
assert(vendorStandOrders.get('sub-e2').status === 'pending', 'a tampered-amount notification does NOT settle the order');
assert(!vendorSubmissions.get('sub-e2').paymentReceived, 'paymentReceived stays unset on a tampered-amount notification');

// Cross-gateway guard, both directions.
resetAllCollections();
resetPricing({ 1: 1500, 2: 2800, 3: 3900 });
seedSubmission('sub-e3');
setActiveGateway('payfast');
const mintedE3 = mintToken('sub-e3');
await callInitiate(mintedE3, 1); // order.gateway === 'payfast'
await callItn(ozowItnPost, { reference: 'VSO-sub-e3', rawStatus: 'paid', grossAmountCents: 150000, gatewayPaymentId: 'oz-1' });
assert(vendorStandOrders.get('sub-e3').status === 'pending', 'an Ozow notification cannot settle a PayFast-created order');

resetAllCollections();
resetPricing({ 1: 1500, 2: 2800, 3: 3900 });
seedSubmission('sub-e4');
setActiveGateway('ozow');
const mintedE4 = mintToken('sub-e4');
await callInitiate(mintedE4, 1); // order.gateway === 'ozow'
await callItn(payfastItnPost, { reference: 'VSO-sub-e4', rawStatus: 'paid', grossAmountCents: 150000, gatewayPaymentId: 'pf-3' });
assert(vendorStandOrders.get('sub-e4').status === 'pending', 'a PayFast notification cannot settle an Ozow-created order');

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);

function mintToken(vendorSubmissionId) {
  // Minted via the real token module directly (not through an HTTP call -- scenarios A/C/D/E
  // want a token in hand without exercising the review route each time; B exercises the real
  // mint-via-approval call site separately), mirroring how a real vendor would receive it by
  // email.
  const secret = process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret, now: new Date() }).token;
}
