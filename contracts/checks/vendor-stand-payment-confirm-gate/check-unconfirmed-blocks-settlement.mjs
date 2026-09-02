#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F1 -- A3: the crux behavioural proof, via the real
// route-runner harness (real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts; only Firestore/payments/mailer infrastructure is
// faked). Proves a CORRECTLY-SIGNED, correct-amount, 'paid'-status ITN notification does NOT
// settle the order when the gateway's own out-of-band server-confirm round trip
// (paymentProvider.confirmNotification()) reports it unconfirmed -- and that it settles
// normally once confirmation is genuinely granted. This is the direct behavioural answer to the
// forged-ITN vulnerability this contract exists to close: signature verification alone is not
// enough, because it only proves the notification was signed with the shared secret, not that
// the gateway itself actually processed a real payment.
//
// Scenario, one order, three ITN deliveries:
//   1. confirmNotification() -> { confirmed: false, reason: 'not-valid' }. The order must stay
//      'pending', vendorSubmissions.paymentReceived must stay unset, ZERO emails of either kind
//      (vendor receipt, admin notice) must be sent, and confirmNotification() must have
//      genuinely been called (not skipped) -- proving the rejection is a real gate outcome, not
//      an accidental early exit elsewhere. The gateway must still be acknowledged 200 (so it
//      stops retrying) -- a 200 here never implies the payment was accepted, matching
//      lib/tickets-notification.ts's own documented contract.
//   2. Same notification, redelivered, confirmNotification() now -> { confirmed: true }. The
//      order settles normally -- proves the earlier rejection was a per-attempt judgement, not
//      a poisoning of the order (a real gateway can and does retry a genuine payment's
//      notification after a transient confirm-endpoint failure).
//   3. The SAME notification redelivered a third time (now against an already-'paid' order) ->
//      ZERO additional emails, same idempotency guarantee the settlement path already carries,
//      proving this feature did not regress it.
//
// RED-verified live (2026-09-02): fails today because confirmNotification() is never called at
// all -- the order settles to 'paid' on step 1's forged-but-unconfirmed notification, which is
// exactly the vulnerability. ACCEPTED LIMITATION: this check proves the gate BEHAVIOUR against a
// fixture-controlled ConfirmResult; it cannot prove PayFast's or Ozow's real
// /eng/query/validate / GetTransactionByReference endpoints are reachable, or that production
// credentials are valid -- see contracts/golden/vendor-stand-payment-confirm-gate/README.md.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-unconfirmed-blocks-settlement.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const {
  resetPaymentsFixture,
  setConfirmNotificationResult,
  confirmNotificationCalls,
  initiateCalls,
} = require('../../harness/route-runner/fixture-payments.mjs');
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
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com,admin-two@example.com';

// Show window far enough out that a real 'now' lands past the early-bird cutoff -- regular
// tier, boothSize 1 -> R1450.00 -> 145000 cents, matching this file's
// `notification.grossAmountCents` (same figures check-settlement-sends-both-emails.mjs already
// relies on).
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

// Returns the REAL `reference` the initiate route minted for this attempt (via the fixture's
// `initiateCalls` log) -- F3 (vendor-stand-payment-confirm-gate) threads a per-attempt id
// through this field, so a hardcoded `VSO-{id}` literal no longer matches what a real gateway
// notification would carry and would be silently accepted only by the (intentionally
// temporary) migration-window fallback, not by the real attempt-identity match this check
// should be exercising.
async function seedPendingOrder(vendorSubmissionId) {
  vendorSubmissions.set(vendorSubmissionId, {
    status: 'approved',
    businessName: 'Fynbos Pottery',
    contactPersonName: 'Jane Vendor',
    contactEmail: 'jane@fynbospottery.example',
  });
  setActiveGateway('payfast');
  const token = mintToken(vendorSubmissionId);
  const result = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
  if (result.status !== 200) {
    throw new Error(`fixture setup failed: initiate returned ${result.status}`);
  }
  const reference = initiateCalls.at(-1)?.reference;
  if (!reference) {
    throw new Error('test setup error: could not capture the real reference from initiateCalls');
  }
  return reference;
}

async function callItn(payload) {
  const res = await payfastItnPost({ text: async () => JSON.stringify(payload), headers: new Headers() });
  return { status: res.status, body: await res.json() };
}

resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
const reference = await seedPendingOrder('sub-unconfirmed');

const notification = {
  reference,
  rawStatus: 'paid',
  grossAmountCents: 145000,
  gatewayPaymentId: 'pf-unconfirmed-1',
};

// =============================================================================================
// 1. Correctly-signed, correct-amount, 'paid' notification -- but the gateway's own
//    server-confirm round trip reports it unconfirmed. Must NOT settle. Must send ZERO emails.
// =============================================================================================
setConfirmNotificationResult({ confirmed: false, reason: 'not-valid' });
const attempt1 = await callItn(notification);

assert(attempt1.status === 200, `expected the gateway to still be acknowledged 200 on an unconfirmed notification, got ${attempt1.status}`);
assert(
  vendorStandOrders.get('sub-unconfirmed')?.status === 'pending',
  `expected the order to remain 'pending' after an unconfirmed notification, got ${JSON.stringify(vendorStandOrders.get('sub-unconfirmed')?.status)}`,
);
assert(
  !vendorSubmissions.get('sub-unconfirmed')?.paymentReceived,
  'expected vendorSubmissions.paymentReceived to remain unset after an unconfirmed notification',
);
assert(
  sentVendorPaymentConfirmations.length === 0,
  `expected ZERO vendor payment confirmation emails after an unconfirmed notification, got ${sentVendorPaymentConfirmations.length}`,
);
assert(
  sentVendorPaymentAdminNotices.length === 0,
  `expected ZERO admin payment notice emails after an unconfirmed notification, got ${sentVendorPaymentAdminNotices.length}`,
);
assert(
  confirmNotificationCalls.length === 1,
  `expected confirmNotification() to have been called exactly once (the gate must actually run, not merely be bypassed by an early return elsewhere), got ${confirmNotificationCalls.length}`,
);

// =============================================================================================
// 2. Same notification redelivered, now genuinely confirmed -- settles normally. Proves the
//    earlier rejection was a per-attempt judgement, not a poisoned/stuck order.
// =============================================================================================
setConfirmNotificationResult({ confirmed: true });
const attempt2 = await callItn(notification);

assert(attempt2.status === 200, `expected the second (confirmed) delivery to be acknowledged 200, got ${attempt2.status}`);
assert(
  vendorStandOrders.get('sub-unconfirmed')?.status === 'paid',
  `expected the order to settle to 'paid' once genuinely confirmed, got ${JSON.stringify(vendorStandOrders.get('sub-unconfirmed')?.status)}`,
);
assert(
  vendorSubmissions.get('sub-unconfirmed')?.paymentReceived === true,
  'expected vendorSubmissions.paymentReceived to flip true once genuinely confirmed',
);
assert(
  sentVendorPaymentConfirmations.length === 1,
  `expected exactly 1 vendor payment confirmation once genuinely settled, got ${sentVendorPaymentConfirmations.length}`,
);
assert(
  sentVendorPaymentAdminNotices.length === 1,
  `expected exactly 1 admin payment notice once genuinely settled, got ${sentVendorPaymentAdminNotices.length}`,
);

// =============================================================================================
// 3. The same notification delivered a THIRD time, against an already-paid order -- ZERO
//    additional emails (existing idempotency guarantee, must not regress).
// =============================================================================================
const countsAfterSettlement = {
  vendor: sentVendorPaymentConfirmations.length,
  admin: sentVendorPaymentAdminNotices.length,
};
const attempt3 = await callItn(notification);
assert(attempt3.status === 200, `expected the third (duplicate, already-paid) delivery to be acknowledged 200, got ${attempt3.status}`);
assert(
  sentVendorPaymentConfirmations.length === countsAfterSettlement.vendor,
  'a duplicate notification against an already-paid order must send zero additional vendor receipts',
);
assert(
  sentVendorPaymentAdminNotices.length === countsAfterSettlement.admin,
  'a duplicate notification against an already-paid order must send zero additional admin notices',
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: a correctly-signed, correct-amount, paid-status ITN that fails the gateway server-' +
    'confirm round trip does not settle the order and sends zero emails of either kind; the ' +
    'same notification genuinely confirmed on redelivery settles normally and sends exactly ' +
    'one of each email; a further duplicate against the now-paid order sends zero more.',
);
process.exit(0);
