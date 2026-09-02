#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F1 -- A4: fail-CLOSED specifically on ConfirmResult's
// `not-configured` reason -- the case Ozow's own confirmNotification() returns when
// OZOW_SANDBOX_SITE_CODE/OZOW_SANDBOX_API_KEY are missing (lib/payments/ozow.ts:56-62). This is
// asserted as its own check, separate from A3's generic unconfirmed-blocks-settlement proof,
// because 'not-configured' is a distinct enough failure reason from a genuine 'not-valid'
// rejection that a plausible-looking implementation could special-case it -- e.g. "if we can't
// even ask the gateway, trust the inbound signature instead", which silently RECREATES the
// vulnerability this contract exists to close under nothing more than a missing config value
// (a deployment/ops mistake, not an attacker action, but the exact same outcome: an order
// settles paid with no confirmed payment). The fix must treat EVERY `confirmed: false` the
// same way regardless of `reason` -- there is no reason value that means "trust it anyway".
//
// Via the real route-runner harness (real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts; only Firestore/payments/mailer infrastructure
// faked). RED-verified live (2026-09-02): fails today for the same root cause as A3 --
// confirmNotification() is never called at all, so its result (of any reason) can never gate
// anything.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-not-configured-fails-closed.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const {
  resetPaymentsFixture,
  setConfirmNotificationResult,
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
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

// Returns the REAL `reference` the initiate route minted (F3's per-attempt id, threaded through
// this field) -- see check-unconfirmed-blocks-settlement.mjs's identical helper for why a
// hardcoded `VSO-{id}` literal is no longer the right shape to test against.
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
const reference = await seedPendingOrder('sub-not-configured');

// Simulates the real Ozow adapter's not-configured guard (missing site code / API key) --
// lib/payments/ozow.ts's confirmNotification() returns exactly this shape when those env keys
// are absent. PayFast's adapter never returns this reason today, but the settlement handler
// must not know or care which gateway produced it -- the guard has to be reason-agnostic.
setConfirmNotificationResult({ confirmed: false, reason: 'not-configured' });

const notification = {
  reference,
  rawStatus: 'paid',
  grossAmountCents: 145000,
  gatewayPaymentId: 'pf-not-configured-1',
};

const attempt = await callItn(notification);

assert(attempt.status === 200, `expected the gateway to still be acknowledged 200, got ${attempt.status}`);
assert(
  vendorStandOrders.get('sub-not-configured')?.status === 'pending',
  `expected the order to remain 'pending' when confirmNotification() reports 'not-configured' -- a missing/absent server-confirm capability must FAIL CLOSED, never be treated as an implicit pass -- got ${JSON.stringify(vendorStandOrders.get('sub-not-configured')?.status)}`,
);
assert(
  !vendorSubmissions.get('sub-not-configured')?.paymentReceived,
  "expected vendorSubmissions.paymentReceived to remain unset when confirmNotification() reports 'not-configured'",
);
assert(
  sentVendorPaymentConfirmations.length === 0,
  `expected ZERO vendor payment confirmation emails when confirmNotification() reports 'not-configured', got ${sentVendorPaymentConfirmations.length}`,
);
assert(
  sentVendorPaymentAdminNotices.length === 0,
  `expected ZERO admin payment notice emails when confirmNotification() reports 'not-configured', got ${sentVendorPaymentAdminNotices.length}`,
);

// Now genuinely confirmed -- proves the earlier 'not-configured' rejection did not poison the
// order (an operator who fixes the missing config must be able to let the notification settle
// on the next real delivery).
setConfirmNotificationResult({ confirmed: true });
const recovered = await callItn(notification);
assert(recovered.status === 200, `expected the recovered delivery to be acknowledged 200, got ${recovered.status}`);
assert(
  vendorStandOrders.get('sub-not-configured')?.status === 'paid',
  "expected the order to settle to 'paid' once confirmNotification() genuinely confirms, after the earlier 'not-configured' rejection",
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  "PASS: a 'not-configured' ConfirmResult (the real Ozow adapter's missing-credential shape) " +
    'fails closed exactly like any other unconfirmed result -- the order is left pending and ' +
    'zero emails are sent -- and settles normally once genuinely confirmed on a later delivery.',
);
process.exit(0);
