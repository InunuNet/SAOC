#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F1 -- A5: the new confirmNotification() call must not
// regress the settlement handler's EXISTING guards -- it must sit AFTER them, not replace or
// race them. Two scenarios, each proving confirmNotification() is never even reached (0 calls)
// when an earlier guard should already have rejected the notification:
//
//   1. AMOUNT MISMATCH -- a notification whose grossAmountCents does not match the order's
//      stored amount must be rejected by the existing amount guard BEFORE confirmNotification()
//      is ever called. Mirrors lib/tickets-notification.ts's own step ordering (amount match,
//      THEN server confirmation) -- confirming a payment amount the order itself never agreed
//      to would be a wasted (and in Ozow's case, chargeable/rate-limited) round trip to the
//      gateway for a notification that was always going to be rejected.
//   2. ALREADY-SETTLED DUPLICATE -- a second notification for an order that is no longer
//      'pending' must be rejected by the existing idempotency short-circuit BEFORE
//      confirmNotification() is called. A gateway's own retry behaviour means every settled
//      order can expect duplicate deliveries; spending a real server-confirm round trip on each
//      one is unnecessary load with no correctness benefit -- the order is already decided.
//
// This check does NOT re-prove that confirmNotification() gates the write (that is A3's job) --
// it isolates a narrower property: WHERE in the guard order the call sits. Via the real
// route-runner harness (real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts; only Firestore/payments/mailer infrastructure
// faked), using the fixture's confirmNotificationCalls call log as the discriminator.
//
// RED-verified live (2026-09-02): both scenarios currently show 0 calls simply because
// confirmNotification() is never called AT ALL (the root defect) -- this check therefore
// currently passes VACUOUSLY on both counts, which is why it is explicitly NOT the check that
// proves the fix exists (A2/A3/A4 are). Once @dev wires the call in, THIS check becomes the one
// that would catch a regression where someone "simplifies" by moving the confirm call earlier
// than the amount guard or the idempotency short-circuit. See the golden README for why this
// ordering matters even though A3 alone would not catch it.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-confirm-call-ordering.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const {
  resetPaymentsFixture,
  confirmNotificationCalls,
  initiateCalls,
} = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');
const {
  resetVendorPaymentConfirmationFixture,
} = require('../../harness/route-runner/fixture-vendor-payment-confirmation.mjs');
const {
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

// =============================================================================================
// 1. Amount mismatch -- confirmNotification() must never be reached.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
const amountMismatchReference = await seedPendingOrder('sub-amount-mismatch');

await callItn({
  reference: amountMismatchReference,
  rawStatus: 'paid',
  grossAmountCents: 1, // real order amount is 145000 cents
  gatewayPaymentId: 'pf-mismatch-1',
});

assert(
  vendorStandOrders.get('sub-amount-mismatch')?.status === 'pending',
  'a tampered-amount notification must not settle the order (pre-existing guard, sanity check for this scenario)',
);
assert(
  confirmNotificationCalls.length === 0,
  `confirmNotification() must never be called when the amount guard has already rejected the notification, got ${confirmNotificationCalls.length} call(s)`,
);

// =============================================================================================
// 2. Already-settled duplicate -- confirmNotification() must never be reached on the replay.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
const duplicateReference = await seedPendingOrder('sub-duplicate');

const paidNotification = {
  reference: duplicateReference,
  rawStatus: 'paid',
  grossAmountCents: 145000,
  gatewayPaymentId: 'pf-duplicate-1',
};

await callItn(paidNotification); // first, genuine settlement
assert(
  vendorStandOrders.get('sub-duplicate')?.status === 'paid',
  'test setup error -- the first delivery should have settled the order',
);

const callsAfterFirstSettlement = confirmNotificationCalls.length;
await callItn(paidNotification); // duplicate replay
assert(
  confirmNotificationCalls.length === callsAfterFirstSettlement,
  `confirmNotification() must never be called again on a duplicate notification against an already-settled order (idempotency short-circuit must run first), went from ${callsAfterFirstSettlement} to ${confirmNotificationCalls.length} call(s)`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: confirmNotification() is never called when the amount guard has already rejected a ' +
    'notification, and never called again on a duplicate delivery against an already-settled ' +
    'order -- the existing guards still run first.',
);
process.exit(0);
