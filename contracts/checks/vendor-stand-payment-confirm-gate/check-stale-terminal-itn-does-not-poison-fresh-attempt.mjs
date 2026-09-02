#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F3 -- the money-loss defect: a late-delivered, correctly-
// signed TERMINAL notification (failed/cancelled) from an ABANDONED payment attempt can mutate
// a NEWER, still-live attempt for the same vendor submission, because
// lib/vendor-stand-payment-notification.ts's non-'paid' branch (line ~214) only checks
// `order.gateway` and `order.status === 'pending'` -- it has no way to tell "this notification
// belongs to the CURRENT attempt" from "this notification belongs to an attempt that was
// already superseded by a re-initiate", because every attempt for one vendor submission shares
// the exact same `VSO-{vendorSubmissionId}` reference today.
//
// Real sequence this check reproduces, using ONLY the real routes (real initiate route, real
// payfast-itn route, real lib/vendor-stand-payment-notification.ts; only Firestore/payments/
// mailer infrastructure faked):
//   1. Vendor initiates a stand payment (attempt A) -- order becomes 'pending'.
//   2. Attempt A is abandoned WITHOUT a terminal notification arriving yet (a very real gateway
//      race: the vendor closes the tab, or the gateway's own notification is delayed/queued).
//   3. Vendor re-initiates (attempt B) -- the EXISTING initiate route legitimately allows this
//      (it only refuses re-initiate against an ALREADY-'paid' order -- see
//      app/api/vendors/stand-payment/initiate/route.ts's own comment "A re-initiate before
//      payment legitimately overwrites the prior pending attempt"), overwriting the SAME
//      Firestore document back to 'pending'.
//   4. Attempt A's stale, correctly-signed 'cancelled' notification NOW arrives late.
//   5. Attempt B's genuine 'paid' notification arrives.
//
// The property under test does NOT assume which mechanism the fix uses (an attempt id embedded
// in the reference, a stored gatewayPaymentId correlator, or anything else) -- this check
// captures whatever `reference` value the REAL initiate route mints for EACH attempt (via the
// route-runner harness's `initiateCalls` log) and replays exactly those captured values back
// through the REAL payfast-itn route, so it stays valid regardless of which correlation
// mechanism @dev chooses, as long as the END-TO-END property holds:
//   - the stale attempt-A notification (step 4) must NOT be able to move attempt B's order out
//     of 'pending'
//   - attempt B's own genuine paid notification (step 5) MUST still settle it normally, with
//     both downstream emails firing.
//
// RED-verified live (2026-09-02): FAILS today -- attempt A's stale reference is BYTE-IDENTICAL
// to attempt B's (today's format has no attempt discriminator at all), so step 4 incorrectly
// flips the live attempt-B order to 'cancelled', and step 5's genuine payment is then silently
// ignored by the pre-existing (correct, unrelated) idempotency guard -- money taken, order
// never settles, zero emails, zero alert. This is exactly the money-loss sequence the team
// lead's Codex pass flagged.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-stale-terminal-itn-does-not-poison-fresh-attempt.mjs

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

const { POST: initiatePost } = await import(INITIATE);
const { POST: payfastItnPost } = await import(PAYFAST_ITN);
const { mintVendorStandPaymentToken } = await import(TOKEN);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com';
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const VENDOR_SUBMISSION_ID = 'sub-stale-terminal';

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
// 1. Attempt A -- vendor initiates, order becomes 'pending'.
// =============================================================================================
const token = mintToken();
const initiateA = await callInitiate(token);
if (initiateA.status !== 200) {
  throw new Error(`test setup error: attempt A initiate returned ${initiateA.status}: ${JSON.stringify(initiateA.body)}`);
}
const attemptAReference = initiateCalls.at(-1)?.reference;
if (!attemptAReference) {
  throw new Error('test setup error: could not capture attempt A\'s reference from initiateCalls');
}
assert(
  vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'pending',
  'test setup error: attempt A should have created a pending order',
);

// =============================================================================================
// 2-3. Attempt A abandoned (no terminal notification arrives YET) -- vendor re-initiates.
//      Attempt B legitimately overwrites the SAME document back to 'pending' (the real
//      initiate route's own documented, intentional behaviour).
// =============================================================================================
const initiateB = await callInitiate(token);
if (initiateB.status !== 200) {
  throw new Error(`test setup error: attempt B initiate returned ${initiateB.status}: ${JSON.stringify(initiateB.body)}`);
}
const attemptBReference = initiateCalls.at(-1)?.reference;
if (!attemptBReference) {
  throw new Error('test setup error: could not capture attempt B\'s reference from initiateCalls');
}
assert(
  vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'pending',
  'test setup error: attempt B should have re-created a pending order',
);

// =============================================================================================
// 4. Attempt A's stale, correctly-signed 'cancelled' notification arrives LATE -- after B is
//    already the live attempt. Must NOT move B's order out of 'pending'.
// =============================================================================================
const staleCancel = await callItn({
  reference: attemptAReference,
  rawStatus: 'cancelled',
  gatewayPaymentId: 'pf-attempt-a-cancel',
});
assert(staleCancel.status === 200, `expected the stale cancel notification to still be acknowledged 200, got ${staleCancel.status}`);
assert(
  vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'pending',
  `a stale terminal notification from an ABANDONED attempt must not move the CURRENT (re-initiated) attempt out of 'pending' -- got status ${JSON.stringify(vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status)}`,
);

// =============================================================================================
// 5. Attempt B's genuine 'paid' notification arrives. Must settle normally -- this is the
//    money the vendor actually paid; it must not be silently lost.
// =============================================================================================
const genuinePaid = await callItn({
  reference: attemptBReference,
  rawStatus: 'paid',
  grossAmountCents: 145000,
  gatewayPaymentId: 'pf-attempt-b-paid',
});
assert(genuinePaid.status === 200, `expected the genuine paid notification to be acknowledged 200, got ${genuinePaid.status}`);
assert(
  vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'paid',
  `the vendor's genuine payment for the CURRENT attempt must settle the order -- money must never be taken with the order left unsettled. Got status ${JSON.stringify(vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status)}`,
);
assert(
  vendorSubmissions.get(VENDOR_SUBMISSION_ID)?.paymentReceived === true,
  'vendorSubmissions.paymentReceived must flip true once the genuine payment settles',
);
assert(
  sentVendorPaymentConfirmations.length === 1,
  `expected exactly 1 vendor payment confirmation once the genuine payment settles, got ${sentVendorPaymentConfirmations.length}`,
);
assert(
  sentVendorPaymentAdminNotices.length === 1,
  `expected exactly 1 admin payment notice once the genuine payment settles, got ${sentVendorPaymentAdminNotices.length}`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: a stale terminal notification from an abandoned, superseded payment attempt cannot ' +
    'move a re-initiated (fresh) attempt out of pending, and the vendor\'s genuine payment for ' +
    'the current attempt settles normally with both emails firing.',
);
process.exit(0);
