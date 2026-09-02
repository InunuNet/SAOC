#!/usr/bin/env node
// vendor-payment-confirmation F1 -- A4: EMAIL-FAILURE-NEVER-BLOCKS proof, via the real
// route-runner harness, composed with the REAL deliverConfirmationEmailAfterCommit. Property 3
// from the spec: a failed vendor-receipt send must never block the gateway's 200
// acknowledgement, must never roll back the already-committed 'paid' transaction, and must
// never suppress the INDEPENDENT admin-notice send (and vice versa) -- one failing email must
// never take the other down with it.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-payment-confirmation/check-failure-isolation.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const { resetPaymentsFixture, initiateCalls } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');
const {
  sentVendorPaymentConfirmations,
  setVendorPaymentConfirmationShouldReject,
  resetVendorPaymentConfirmationFixture,
} = require('../../harness/route-runner/fixture-vendor-payment-confirmation.mjs');
const {
  sentVendorPaymentAdminNotices,
  setVendorPaymentAdminNoticeShouldReject,
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

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

// Returns the REAL `reference` the initiate route minted for this attempt (via the fixture's
// `initiateCalls` log) -- F3 (vendor-stand-payment-confirm-gate) threads a per-attempt id
// through this field, so a hardcoded `VSO-{id}` literal no longer matches what a real gateway
// notification would carry (a bare reference with no attempt suffix is now REJECTED once the
// order has an attemptId -- see A11). Same fix as A3's check-settlement-sends-both-emails.mjs.
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

async function callItn(reference) {
  const payload = { reference, rawStatus: 'paid', grossAmountCents: 145000, gatewayPaymentId: `pf-${reference}` };
  const res = await payfastItnPost({ text: async () => JSON.stringify(payload), headers: new Headers() });
  return { status: res.status, body: await res.json() };
}

// =============================================================================================
// Scenario A: the vendor receipt's mailer rejects. The gateway must still get its 200, the
// order must still settle to 'paid', and the (independent) admin notice must still be attempted.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
setVendorPaymentConfirmationShouldReject(true);

const referenceA = await seedPendingOrder('sub-vendor-fails');
const resultA = await callItn(referenceA);

assert(
  resultA.status === 200,
  `Scenario A: expected 200 even though the vendor receipt's send rejected, got ${resultA.status} -- a failed confirmation email must never block the gateway's acknowledgement.`,
);
assert(
  vendorStandOrders.get('sub-vendor-fails')?.status === 'paid',
  'Scenario A: the order must still settle to \'paid\' even though the vendor receipt send rejected -- money is more important than a delivery receipt.',
);
assert(
  sentVendorPaymentConfirmations.length === 1,
  `Scenario A: the vendor receipt send must still have been GENUINELY ATTEMPTED (not skipped) even though it was set to reject -- got ${sentVendorPaymentConfirmations.length} attempt(s).`,
);
assert(
  sentVendorPaymentAdminNotices.length === 1,
  `Scenario A: the admin notice is INDEPENDENT of the vendor receipt -- a rejecting vendor-receipt send must not suppress it. Got ${sentVendorPaymentAdminNotices.length} admin notice(s), expected 1.`,
);

// =============================================================================================
// Scenario B: the admin notice's mailer rejects instead. The vendor receipt (the more
// important of the two, from the vendor's perspective) must still be sent, and the gateway
// must still get its 200.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
setVendorPaymentConfirmationShouldReject(false);
setVendorPaymentAdminNoticeShouldReject(true);

const referenceB = await seedPendingOrder('sub-admin-fails');
const resultB = await callItn(referenceB);

assert(
  resultB.status === 200,
  `Scenario B: expected 200 even though the admin notice's send rejected, got ${resultB.status}.`,
);
assert(
  vendorStandOrders.get('sub-admin-fails')?.status === 'paid',
  'Scenario B: the order must still settle to \'paid\' even though the admin notice send rejected.',
);
assert(
  sentVendorPaymentAdminNotices.length === 1,
  `Scenario B: the admin notice send must still have been GENUINELY ATTEMPTED even though it was set to reject -- got ${sentVendorPaymentAdminNotices.length} attempt(s).`,
);
assert(
  sentVendorPaymentConfirmations.length === 1,
  `Scenario B: the vendor's own receipt must NOT be suppressed by an admin-notice failure -- got ${sentVendorPaymentConfirmations.length} vendor receipt(s), expected 1.`,
);

setVendorPaymentAdminNoticeShouldReject(false);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: a rejecting vendor-receipt send still lets the gateway ack 200, still lets the order ' +
    'settle to paid, and never suppresses the independent admin notice -- and vice versa.',
);
process.exit(0);
