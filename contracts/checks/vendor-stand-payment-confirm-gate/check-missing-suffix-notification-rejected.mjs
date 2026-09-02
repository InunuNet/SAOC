#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F3 -- A11: the STRICT half of the attempt-identity guard
// A7 does not isolate. A7 proves a notification carrying a PARSEABLE-BUT-MISMATCHED attempt
// suffix (attempt A's own captured reference, replayed late) is rejected. It does NOT prove
// anything about a notification whose `reference` carries NO suffix at all -- a bare
// `VSO-{vendorSubmissionId}` string with no `::{attemptId}` segment, the exact pre-F3 shape,
// which is trivially attacker-constructible from nothing but the public vendorSubmissionId
// (visible in the vendor's own registration-approval email/URL).
//
// A permissive implementation of F3's guard can pass A7 while still accepting this shape: e.g.
// `if (order?.attemptId) { const notificationAttemptId = parseAttemptIdFromStandOrderRef(ref);
// if (notificationAttemptId && notificationAttemptId !== order.attemptId) { reject } }` --
// `parseAttemptIdFromStandOrderRef` returns `null` for a bare reference, the `notificationAttemptId
// &&` short-circuits, and the notification falls through to being trusted, even though the order
// HAS a real attemptId to compare against. That is precisely the loophole this check isolates.
//
// Per the contract's now-tightened F3 spec: `order.attemptId` present is the ONLY thing that
// determines whether a comparison is required -- a missing suffix is exactly as much a mismatch
// as a parseable-but-different one once the order has an attemptId. The ONLY carve-out is an
// order with NO `attemptId` stored on the order document itself (the pre-fix migration window),
// which this check does not exercise (A7 already establishes a fresh attempt always gets an
// attemptId; this check reuses the same real initiate route, so the order always has one here).
//
// Via the real route-runner harness (real initiate route, real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts; only Firestore/payments/mailer infrastructure
// faked). Sequence:
//   1. Vendor initiates -- order becomes 'pending' with a real, route-minted `attemptId`.
//   2. A notification is delivered whose `reference` is a BARE, no-suffix string derived from
//      the same vendorSubmissionId (constructed the same way an attacker with nothing but the
//      public vendorSubmissionId could construct it -- NOT the captured real reference, which
//      always carries the real suffix in the fixed implementation). Correctly signed (via the
//      real payfast-itn route, matching the fixture's HMAC secret), correct amount, 'paid'
//      status. MUST be rejected: order stays 'pending', zero emails, HTTP 200.
//   3. The order's OWN genuine notification (using the real captured reference) is then
//      delivered -- MUST settle normally, proving the missing-suffix rejection was per-notification,
//      not a poisoned order.
//
// RED-verified live (2026-09-02) against @dev's CURRENT implementation (rejects only a
// parseable-but-mismatched suffix, falls through to accept a missing one): FAILS at step 2 --
// the bare-reference notification is wrongly accepted and settles the order to 'paid', with both
// emails firing, before the order's own genuine notification is ever delivered.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-missing-suffix-notification-rejected.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const { resetPaymentsFixture, initiateCalls } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');
const {
  sentVendorPaymentConfirmations,
  resetVendorPaymentConfirmationFixture,
} = require('../../harness/route-runner/fixture-vendor-payment-confirmation.mjs');
const {
  sentVendorPaymentAdminNotices,
  resetVendorPaymentAdminNoticeFixture,
} = require('../../harness/route-runner/fixture-vendor-payment-admin-notice.mjs');

const INITIATE = '../../../app/api/vendors/stand-payment/initiate/route.ts';
const PAYFAST_ITN = '../../../app/api/vendors/stand-payment/payfast-itn/route.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';
const ORDERS = '../../../lib/vendor-stand-orders.ts';

const { POST: initiatePost } = await import(INITIATE);
const { POST: payfastItnPost } = await import(PAYFAST_ITN);
const { mintVendorStandPaymentToken } = await import(TOKEN);
const { buildVendorStandOrderRef } = await import(ORDERS);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com';
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const VENDOR_SUBMISSION_ID = 'sub-missing-suffix';

function mintToken() {
  return mintVendorStandPaymentToken({ vendorSubmissionId: VENDOR_SUBMISSION_ID, secret: TEST_SECRET, now: new Date() }).token;
}

async function callInitiate(token) {
  const res = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
  return { status: res.status, body: await res.json() };
}

async function callItn(payload) {
  const res = await payfastItnPost({ text: async () => JSON.stringify(payload), headers: new Headers() });
  return { status: res.status, body: await res.json() };
}

resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
setActiveGateway('payfast');

vendorSubmissions.set(VENDOR_SUBMISSION_ID, {
  status: 'approved',
  businessName: 'Fynbos Pottery',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@fynbospottery.example',
});

// =============================================================================================
// 1. Vendor initiates -- order becomes 'pending' with a real attemptId minted by the real route.
// =============================================================================================
const token = mintToken();
const initiateResult = await callInitiate(token);
if (initiateResult.status !== 200) {
  throw new Error(`test setup error: initiate returned ${initiateResult.status}: ${JSON.stringify(initiateResult.body)}`);
}
const realReference = initiateCalls.at(-1)?.reference;
if (!realReference) {
  throw new Error('test setup error: could not capture the real reference from initiateCalls');
}
assert(
  vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'pending',
  'test setup error: initiate should have created a pending order',
);
assert(
  Boolean(vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.attemptId),
  'test setup error: the order must have a real attemptId stored for this check to isolate anything -- if this fails, F3 is not wired at all (A2/A7 territory, not A11\'s)',
);

// =============================================================================================
// 2. A notification arrives whose reference is BARE -- no `::{attemptId}` suffix -- derived
//    from nothing but the public vendorSubmissionId, NOT the real captured reference. Must be
//    REJECTED, exactly like a parseable-but-mismatched suffix (A7) is.
// =============================================================================================
const bareReference = buildVendorStandOrderRef(VENDOR_SUBMISSION_ID);
assert(
  bareReference !== realReference,
  `test setup error: the bare reference (${bareReference}) must differ from the real captured reference (${realReference}) for this check to test anything`,
);

const missingSuffixAttempt = await callItn({
  reference: bareReference,
  rawStatus: 'paid',
  grossAmountCents: 145000,
  gatewayPaymentId: 'pf-missing-suffix-1',
});

assert(
  missingSuffixAttempt.status === 200,
  `expected the gateway to still be acknowledged 200 on a missing-suffix notification, got ${missingSuffixAttempt.status}`,
);
assert(
  vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'pending',
  `a notification with NO attempt suffix against an order that HAS an attemptId must be REJECTED, not fallback-accepted -- got status ${JSON.stringify(vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status)}`,
);
assert(
  !vendorSubmissions.get(VENDOR_SUBMISSION_ID)?.paymentReceived,
  'vendorSubmissions.paymentReceived must remain unset after a missing-suffix notification is (correctly) rejected',
);
assert(
  sentVendorPaymentConfirmations.length === 0,
  `expected ZERO vendor payment confirmation emails after a missing-suffix notification is rejected, got ${sentVendorPaymentConfirmations.length}`,
);
assert(
  sentVendorPaymentAdminNotices.length === 0,
  `expected ZERO admin payment notice emails after a missing-suffix notification is rejected, got ${sentVendorPaymentAdminNotices.length}`,
);

// =============================================================================================
// 3. The order's OWN genuine notification (real captured reference) is then delivered -- must
//    settle normally. Proves the missing-suffix rejection was per-notification, not a poisoned
//    order (mirrors A3/A7's same "rejection is not permanent" proof).
// =============================================================================================
const genuine = await callItn({
  reference: realReference,
  rawStatus: 'paid',
  grossAmountCents: 145000,
  gatewayPaymentId: 'pf-missing-suffix-genuine',
});
assert(genuine.status === 200, `expected the genuine notification to be acknowledged 200, got ${genuine.status}`);
assert(
  vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'paid',
  `the order's own genuine notification must still settle it after an unrelated missing-suffix notification was rejected -- got status ${JSON.stringify(vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status)}`,
);
assert(
  vendorSubmissions.get(VENDOR_SUBMISSION_ID)?.paymentReceived === true,
  'vendorSubmissions.paymentReceived must flip true once the genuine notification settles',
);
assert(
  sentVendorPaymentConfirmations.length === 1,
  `expected exactly 1 vendor payment confirmation once the genuine notification settles, got ${sentVendorPaymentConfirmations.length}`,
);
assert(
  sentVendorPaymentAdminNotices.length === 1,
  `expected exactly 1 admin payment notice once the genuine notification settles, got ${sentVendorPaymentAdminNotices.length}`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: a notification with NO attempt suffix at all is rejected exactly like a parseable-' +
    'but-mismatched one, against an order that HAS a real attemptId -- zero emails, order stays ' +
    'pending -- and the order\'s own genuine notification still settles normally afterward.',
);
process.exit(0);
