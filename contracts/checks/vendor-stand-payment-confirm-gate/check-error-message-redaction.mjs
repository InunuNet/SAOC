#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F5 -- a rejecting mailer's error message can embed the
// offending recipient's email address (a real, common shape for provider validation errors,
// e.g. "Invalid `to` field: jane@example.com is not a verified sender/recipient"). The SENDER
// modules themselves (lib/vendor-payment-confirmation.ts, lib/vendor-payment-admin-notice.ts)
// already log no PII (contracts/contract-vendor-payment-confirmation.yaml's A5, a STATIC
// discriminator on those two files) -- but the CALLER,
// lib/vendor-stand-payment-notification.ts's two onError handlers (line ~242-246 for the admin
// notice, line ~268-272 for the vendor receipt), logs `error.message` VERBATIM. A5's static
// check structurally cannot catch this: the PII in scope here is INTERPOLATED INTO the caught
// error's message at RUNTIME by whatever threw it, not a literal string anywhere in the source
// text A5 inspects. This check is the runtime-behavioural proof A5 cannot be.
//
// Fix must redact any email-address-shaped substring out of a caught error's message before it
// reaches console.error, in BOTH onError handlers.
//
// BEHAVIOURAL, via the real route-runner harness (real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts; only Firestore/payments/mailer/console
// infrastructure faked). Two scenarios, symmetric: the vendor-receipt send rejects with an
// email-embedding message; the admin-notice send rejects with an email-embedding message.
// console.error is intercepted directly (not via a fixture module) so this check observes
// EXACTLY what reaches the log stream, the same technique
// check-blank-identity-logs-and-settles.mjs already uses.
//
// RED-verified live (2026-09-02): FAILS both scenarios -- the real email address appears
// verbatim in a captured console.error call.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-error-message-redaction.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const { resetPaymentsFixture, initiateCalls } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');
const {
  resetVendorPaymentConfirmationFixture,
  setVendorPaymentConfirmationShouldReject,
  setVendorPaymentConfirmationRejectMessage,
} = require('../../harness/route-runner/fixture-vendor-payment-confirmation.mjs');
const {
  resetVendorPaymentAdminNoticeFixture,
  setVendorPaymentAdminNoticeShouldReject,
  setVendorPaymentAdminNoticeRejectMessage,
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

const VENDOR_CONTACT_EMAIL = 'jane@fynbospottery.example';

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

async function seedPendingOrder(vendorSubmissionId) {
  vendorSubmissions.set(vendorSubmissionId, {
    status: 'approved',
    businessName: 'Fynbos Pottery',
    contactPersonName: 'Jane Vendor',
    contactEmail: VENDOR_CONTACT_EMAIL,
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

async function callItnCapturingErrorLogs(reference) {
  const payload = { reference, rawStatus: 'paid', grossAmountCents: 145000, gatewayPaymentId: `pf-${reference}` };
  const capturedErrorLogs = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    capturedErrorLogs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  let res;
  try {
    res = await payfastItnPost({ text: async () => JSON.stringify(payload), headers: new Headers() });
  } finally {
    console.error = originalConsoleError;
  }
  return { status: res.status, capturedErrorLogs };
}

// =============================================================================================
// Scenario A: the vendor receipt's mailer rejects with an error message that embeds the real
// contactEmail (a realistic provider-validation-error shape).
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
setVendorPaymentConfirmationShouldReject(true);
setVendorPaymentConfirmationRejectMessage(`Resend validation error: recipient ${VENDOR_CONTACT_EMAIL} is not a verified address in sandbox mode`);

const referenceA = await seedPendingOrder('sub-redact-vendor');
const scenarioA = await callItnCapturingErrorLogs(referenceA);

assert(scenarioA.status === 200, `Scenario A: expected 200, got ${scenarioA.status}`);
const scenarioALeaks = scenarioA.capturedErrorLogs.some((line) => line.includes(VENDOR_CONTACT_EMAIL));
assert(
  !scenarioALeaks,
  `Scenario A: the vendor receipt's onError handler logged the real contactEmail (${VENDOR_CONTACT_EMAIL}) verbatim from the caught error's message -- must be redacted before logging. Captured: ${JSON.stringify(scenarioA.capturedErrorLogs)}`,
);
// A genuine log line about the failure must still exist -- redaction must not become silence
// (that would just trade F5 for a milder version of F4's problem).
const scenarioAHasFailureLog = scenarioA.capturedErrorLogs.some((line) => /vendor payment confirmation/i.test(line));
assert(
  scenarioAHasFailureLog,
  `Scenario A: expected a (redacted) log line about the vendor payment confirmation failure to still exist -- redaction must not mean no log at all. Captured: ${JSON.stringify(scenarioA.capturedErrorLogs)}`,
);

// =============================================================================================
// Scenario B: the admin notice's mailer rejects instead, symmetric proof.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
setVendorPaymentAdminNoticeShouldReject(true);
setVendorPaymentAdminNoticeRejectMessage(`Resend validation error: recipient ${VENDOR_CONTACT_EMAIL} is not a verified address in sandbox mode`);

const referenceB = await seedPendingOrder('sub-redact-admin');
const scenarioB = await callItnCapturingErrorLogs(referenceB);

assert(scenarioB.status === 200, `Scenario B: expected 200, got ${scenarioB.status}`);
const scenarioBLeaks = scenarioB.capturedErrorLogs.some((line) => line.includes(VENDOR_CONTACT_EMAIL));
assert(
  !scenarioBLeaks,
  `Scenario B: the admin notice's onError handler logged the real contactEmail (${VENDOR_CONTACT_EMAIL}) verbatim from the caught error's message -- must be redacted before logging. Captured: ${JSON.stringify(scenarioB.capturedErrorLogs)}`,
);
const scenarioBHasFailureLog = scenarioB.capturedErrorLogs.some((line) => /payment admin notice/i.test(line));
assert(
  scenarioBHasFailureLog,
  `Scenario B: expected a (redacted) log line about the admin notice failure to still exist. Captured: ${JSON.stringify(scenarioB.capturedErrorLogs)}`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: neither onError handler leaks a real email address embedded in a caught mailer ' +
    'error message -- both scenarios log a redacted failure line naming no PII.',
);
process.exit(0);
