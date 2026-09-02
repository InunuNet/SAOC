#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F4 -- a paid submission whose `businessName` or
// `contactPersonName` is blank/missing (normal validation should prevent this, but a backfill
// or manual Firestore edit can produce it) still settles the order -- correctly, this is a
// deliberate design choice this contract does NOT change (money already moved; refusing to
// settle it would be worse) -- but today the whole notification block goes SILENT: `paidNotice`
// (lib/vendor-stand-payment-notification.ts line ~179) is never populated, so the `if
// (paidNotice)` block (line ~230) is skipped in total, meaning ZERO emails fire and there is NO
// LOG LINE anywhere recording that this happened. A paid order exists that nobody -- vendor or
// admin -- is ever told about, and nothing in the logs says why.
//
// Fix must: settlement proceeds unchanged (order still flips to 'paid', unchanged from today);
// the skip is now LOGGED, naming `vendorSubmissionId` and NO PII (no businessName, no
// contactEmail, no contactPersonName -- coordinated with A5 of
// contracts/contract-vendor-payment-confirmation.yaml, the existing static no-PII discriminator
// on lib/vendor-payment-confirmation.ts; this check is the equivalent BEHAVIOURAL proof for the
// CALLER, lib/vendor-stand-payment-notification.ts, which that static check does not cover).
//
// BEHAVIOURAL, via the real route-runner harness (real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts; only Firestore/payments/mailer/console
// infrastructure faked -- console.error is intercepted here, not by a fixture module, since
// this property is specifically about what reaches the log stream).
//
// RED-verified live (2026-09-02): the order settles (unchanged, expected), zero emails fire
// (expected, unchanged), but ZERO console.error calls are made recording the skip -- the gap is
// completely invisible in the logs today.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-blank-identity-logs-and-settles.mjs

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

const VENDOR_SUBMISSION_ID = 'sub-blank-identity';
// Deliberately realistic PII values -- if the fix's new log line ever interpolated one of
// these, this check's log-content assertion below would catch it.
const REAL_CONTACT_EMAIL = 'jane@fynbospottery.example';
const REAL_BUSINESS_NAME = 'Fynbos Pottery';

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

// Approved (so initiate succeeds), but businessName/contactPersonName are blank -- exactly the
// "normal validation should prevent this" backfill/manual-edit shape the team lead described.
// contactEmail is deliberately real/present, to prove a real PII value is in scope for
// accidental logging even though this specific defect is about businessName/contactPersonName.
vendorSubmissions.set(VENDOR_SUBMISSION_ID, {
  status: 'approved',
  businessName: '',
  contactPersonName: '',
  contactEmail: REAL_CONTACT_EMAIL,
});

const token = mintToken();
const initiateResult = await callInitiate(token);
if (initiateResult.status !== 200) {
  throw new Error(`test setup error: initiate returned ${initiateResult.status}: ${JSON.stringify(initiateResult.body)}`);
}
const reference = initiateCalls.at(-1)?.reference;
if (!reference) {
  throw new Error('test setup error: could not capture the real reference from initiateCalls');
}

// Intercept console.error for the duration of the ITN call only, so this check observes
// EXACTLY what the real settlement handler logs for this scenario -- not what any fixture
// module logs.
const capturedErrorLogs = [];
const originalConsoleError = console.error;
console.error = (...args) => {
  capturedErrorLogs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
};

let itnResult;
try {
  itnResult = await callItn({
    reference,
    rawStatus: 'paid',
    grossAmountCents: 145000,
    gatewayPaymentId: 'pf-blank-identity-1',
  });
} finally {
  console.error = originalConsoleError;
}

assert(itnResult.status === 200, `expected the paid notification to be acknowledged 200, got ${itnResult.status}`);

// Settlement must proceed UNCHANGED -- this contract does not alter that behaviour, only the
// silence around it.
assert(
  vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'paid',
  `expected the order to still settle to 'paid' even with a blank businessName/contactPersonName (unchanged behaviour) -- got ${JSON.stringify(vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status)}`,
);
assert(
  sentVendorPaymentConfirmations.length === 0,
  `expected zero vendor receipt emails (unchanged -- paidNotice cannot be built without businessName/contactPersonName), got ${sentVendorPaymentConfirmations.length}`,
);
assert(
  sentVendorPaymentAdminNotices.length === 0,
  `expected zero admin notice emails (unchanged, same reason), got ${sentVendorPaymentAdminNotices.length}`,
);

// THE FIX: exactly one console.error call must record this specific skip, naming the
// vendorSubmissionId, and it must never leak the real contactEmail (present on the submission,
// even though this scenario's defect is about businessName/contactPersonName) or any other PII
// value.
const relevantLogs = capturedErrorLogs.filter((line) => line.includes(VENDOR_SUBMISSION_ID));
assert(
  relevantLogs.length >= 1,
  `expected at least one console.error call naming vendorSubmissionId (${VENDOR_SUBMISSION_ID}) to record that a paid order's notification emails were skipped due to missing businessName/contactPersonName -- got ${capturedErrorLogs.length} console.error call(s) total, none mentioning the submission id`,
);
const leaksEmail = capturedErrorLogs.some((line) => line.includes(REAL_CONTACT_EMAIL));
assert(!leaksEmail, `a console.error call leaked the real contactEmail (${REAL_CONTACT_EMAIL}) -- the new log line must name only vendorSubmissionId, never PII`);
const leaksBusinessNameLiteral = capturedErrorLogs.some((line) => line.includes(REAL_BUSINESS_NAME));
assert(!leaksBusinessNameLiteral, `a console.error call appears to reference the business name literal (${REAL_BUSINESS_NAME}) -- must never happen (it is also blank in this scenario, so this guards against a future scenario reusing this pattern with a non-blank name)`);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: a paid order whose submission has blank businessName/contactPersonName still ' +
    'settles and still sends zero emails (unchanged), AND now logs the skip naming only the ' +
    'vendorSubmissionId, with no PII (contactEmail, businessName) reaching the log stream.',
);
process.exit(0);
