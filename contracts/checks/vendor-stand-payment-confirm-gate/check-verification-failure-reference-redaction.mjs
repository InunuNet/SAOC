#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F8 -- a third defect found by the same Codex GPT-5.5 pass,
// lower confidence than F6/F7 but cheap to fix and cheap to prove. lib/vendor-stand-payment-
// notification.ts:114 logs `verification.reference` VERBATIM on a signature-verification
// failure -- BEFORE any parsing, any ownership check, any relationship to a real order. That
// reference is entirely ATTACKER-CONTROLLED at this point in the handler (an unsigned or
// malformed notification's `m_payment_id`/`TransactionReference` field, read straight off the
// wire) -- an attacker can put anything there, including a real or fabricated email address
// (e.g. `m_payment_id=alice@example.com`), and it reaches `console.error` unredacted. This is a
// DIFFERENT path from F5 (which redacts a caught MAILER error's message) -- F5's
// `redactEmailAddresses()` helper exists and is proven (A9) to be applied to the two onError
// handlers, but is NOT applied here, at this much earlier, unauthenticated-input log line.
//
// Not the vendor-contact path (this fires before any vendorSubmissionId is even resolved), but
// a real submitted-PII / log-poisoning route: anyone can POST an unsigned notification with an
// arbitrary string in the reference field and have it written to production logs verbatim.
//
// SPEC: apply the SAME `redactEmailAddresses()` helper F5 already introduced to
// `verification.reference` before it reaches this `console.error` call (line ~114). Cheapest
// fix in this contract -- reuses the existing helper.
//
// Via the real route-runner harness (real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts; only Firestore/payments infrastructure faked, and
// console.error intercepted directly, the same technique check-blank-identity-logs-and-
// settles.mjs and check-error-message-redaction.mjs already use). Delivers a notification that
// fails verification (the fixture's `__invalidSignature` flag) whose `reference` field embeds a
// real-shaped email address -- MUST NOT appear verbatim in any captured console.error call.
//
// RED-verified live (2026-09-02): FAILS -- the real email address appears verbatim in the
// captured "Notification rejected before any order was touched" log line.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-verification-failure-reference-redaction.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resetAllCollections } = require('../../harness/route-runner/store.mjs');
const { resetPaymentsFixture } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');
const {
  resetVendorPaymentConfirmationFixture,
} = require('../../harness/route-runner/fixture-vendor-payment-confirmation.mjs');
const {
  resetVendorPaymentAdminNoticeFixture,
} = require('../../harness/route-runner/fixture-vendor-payment-admin-notice.mjs');

const PAYFAST_ITN = '../../../app/api/vendors/stand-payment/payfast-itn/route.ts';

const { POST: payfastItnPost } = await import(PAYFAST_ITN);

process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = 'test-stand-payment-secret-not-real';
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com';
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
setActiveGateway('payfast');

// An attacker-controlled reference embedding a real-shaped email address, on a notification
// that FAILS signature verification (the fixture's own `__invalidSignature` flag) -- this
// notification has no relationship to any real order and is fully attacker-constructed.
const ATTACKER_EMBEDDED_EMAIL = 'alice@example.com';
const payload = {
  __invalidSignature: true,
  reference: `VSO-forged::${ATTACKER_EMBEDDED_EMAIL}`,
};

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

assert(res.status === 200, `expected the gateway to still be acknowledged 200 on a verification failure, got ${res.status}`);

const leaks = capturedErrorLogs.some((line) => line.includes(ATTACKER_EMBEDDED_EMAIL));
assert(
  !leaks,
  `an attacker-controlled reference embedding a real-shaped email address (${ATTACKER_EMBEDDED_EMAIL}) must not reach console.error verbatim on a verification failure -- must be redacted, the same as F5's caught-mailer-error redaction. Captured: ${JSON.stringify(capturedErrorLogs)}`,
);
// Redaction must not become silence (same "still diagnosable" requirement F5's own checks
// enforce) -- a genuine log line about the rejection must still exist.
const hasFailureLog = capturedErrorLogs.some((line) => /rejected before any order was touched/i.test(line));
assert(
  hasFailureLog,
  `expected a (redacted) log line about the verification failure to still exist -- redaction must not mean no log at all. Captured: ${JSON.stringify(capturedErrorLogs)}`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: an attacker-controlled reference on a verification-failed notification never leaks an ' +
    'embedded email address to console.error verbatim, while a redacted failure log line still ' +
    'exists.',
);
process.exit(0);
