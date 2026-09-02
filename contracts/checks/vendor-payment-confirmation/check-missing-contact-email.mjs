#!/usr/bin/env node
// vendor-payment-confirmation F1 -- A8: BEHAVIOURAL proof of the team lead's ground-truth
// correction #2. The existing capture guard (`if (submission?.businessName &&
// submission.contactPersonName)`) must NOT be widened to also require contactEmail -- a
// submission with businessName+contactPersonName but a missing/empty/whitespace-only
// contactEmail must:
//   - still fire the admin notice exactly once (unchanged behaviour -- the admin notice has
//     nothing to do with whether a vendor address exists)
//   - fire the vendor receipt ZERO times (there is no address to send it to)
//   - still let the gateway ack 200 and the order settle to 'paid'
//   - log exactly one console.error naming ONLY the vendorSubmissionId -- never businessName,
//     contactPersonName, or any other submitted field, so the silent-drop case is diagnosable
//     without becoming a second PII leak
//
// Exercises the real route-runner harness -- real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts, REUSING the existing fixtures A3/A4 already use
// (fixture-vendor-payment-confirmation.mjs, fixture-vendor-payment-admin-notice.mjs) -- no new
// fixtures added for this check.
//
// COORDINATION WITH A5 (check-no-pii-in-logs.mjs): A5's job is to prove
// lib/vendor-payment-confirmation.ts (the vendor-facing SENDER module) contains ZERO console.*
// calls at all -- an absolute rule that module can hold because it has no legitimate reason to
// log anything. lib/vendor-stand-payment-notification.ts (checked here) is a different kind of
// module -- an audit-log handler that legitimately calls console.error for many unrelated
// reasons (verification failures, gateway mismatches, amount tampering, etc.) -- so A8 does NOT
// assert "zero console.* calls" the way A5 does. Instead it isolates the ONE
// missing-contactEmail log line and asserts its arguments never contain a submitted PII field
// VALUE, using the SAME definition of "submitted PII" A5 uses (businessName, contactPersonName,
// contactEmail) -- see containsSubmittedPii() below, self-tested inline against known-bad and
// known-clean synthetic log lines before it is ever pointed at real captured output, exactly
// the same "self-test the discriminator" discipline A2/A5/A6 already apply to their own
// source-text checks.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-payment-confirmation/check-missing-contact-email.mjs

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

const BUSINESS_NAME = 'Fynbos Pottery';
const CONTACT_PERSON = 'Jane Vendor';

// -------------------------------------------------------------------------------------------
// containsSubmittedPii -- the SAME "submitted PII" definition A5 (check-no-pii-in-logs.mjs)
// uses for lib/vendor-payment-confirmation.ts (businessName, contactPersonName, contactEmail),
// applied here as a value-absence scan over a captured console.error call's arguments, plus a
// generic email-shape scan so a DIFFERENT leaked address (not just this scenario's own
// contactEmail literal, which is deliberately blank/whitespace) would still be caught.
// -------------------------------------------------------------------------------------------
const EMAIL_SHAPE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

function containsSubmittedPii(flatArgs, pii) {
  if (pii.businessName && flatArgs.includes(pii.businessName)) return true;
  if (pii.contactPersonName && flatArgs.includes(pii.contactPersonName)) return true;
  if (EMAIL_SHAPE.test(flatArgs)) return true;
  return false;
}

// Self-test: the discriminator must flag known-bad synthetic log lines (each PII field leaking
// on its own) and must NOT flag a clean, submission-id-only log line.
{
  const pii = { businessName: BUSINESS_NAME, contactPersonName: CONTACT_PERSON };
  const knownBad = [
    JSON.stringify(['leaked business name:', BUSINESS_NAME]),
    JSON.stringify(['leaked contact person:', CONTACT_PERSON]),
    JSON.stringify(['leaked address:', 'jane@fynbospottery.example']),
  ];
  for (const bad of knownBad) {
    if (!containsSubmittedPii(bad, pii)) {
      console.error(`FAIL (self-test): containsSubmittedPii() did not flag a KNOWN-BAD PII-leaking log line: ${bad}`);
      process.exit(1);
    }
  }
  const knownClean = JSON.stringify(['[vendors/stand-payment] Paid submission has no contactEmail -- vendor payment receipt not sent', { vendorSubmissionId: 'sub-no-email' }]);
  if (containsSubmittedPii(knownClean, pii)) {
    console.error(`FAIL (self-test): containsSubmittedPii() false-flagged a KNOWN-CLEAN log line: ${knownClean}`);
    process.exit(1);
  }
}

async function runScenario(vendorSubmissionId, contactEmailValue, label) {
  resetAllCollections();
  resetPaymentsFixture();
  resetVendorPaymentConfirmationFixture();
  resetVendorPaymentAdminNoticeFixture();

  vendorSubmissions.set(vendorSubmissionId, {
    status: 'approved',
    businessName: BUSINESS_NAME,
    contactPersonName: CONTACT_PERSON,
    contactEmail: contactEmailValue,
  });
  setActiveGateway('payfast');
  const token = mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
  const initiateResult = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
  if (initiateResult.status !== 200) {
    throw new Error(`[${label}] fixture setup error: initiate returned ${initiateResult.status}`);
  }
  // F3 (vendor-stand-payment-confirm-gate) threads a per-attempt id through `reference`, so a
  // hardcoded `VSO-{id}` literal no longer matches what a real gateway notification would carry
  // (a bare reference with no attempt suffix is now REJECTED once the order has an attemptId --
  // see A11). Capture the REAL minted reference from the fixture's `initiateCalls` log instead,
  // same fix as A3/A4's checks in this same directory.
  const reference = initiateCalls.at(-1)?.reference;
  if (!reference) {
    throw new Error(`[${label}] test setup error: could not capture the real reference from initiateCalls`);
  }

  // Capture console.error calls so we can assert on exactly what was (and wasn't) logged,
  // without suppressing real errors from other parts of the app permanently.
  const capturedErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    capturedErrors.push(args);
  };

  let itnResult;
  try {
    itnResult = await payfastItnPost({
      text: async () => JSON.stringify({
        reference,
        rawStatus: 'paid',
        grossAmountCents: 145000,
        gatewayPaymentId: `pf-${vendorSubmissionId}`,
      }),
      headers: new Headers(),
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert(itnResult.status === 200, `[${label}] expected 200, got ${itnResult.status}`);
  assert(
    vendorStandOrders.get(vendorSubmissionId)?.status === 'paid',
    `[${label}] the order must still settle to 'paid' even though contactEmail is ${JSON.stringify(contactEmailValue)} -- a missing/blank vendor address is not a payment failure.`,
  );
  assert(
    sentVendorPaymentAdminNotices.length === 1,
    `[${label}] expected the admin notice to STILL fire exactly once (unchanged behaviour) when contactEmail is ${JSON.stringify(contactEmailValue)} -- got ${sentVendorPaymentAdminNotices.length}. The capture guard must remain businessName+contactPersonName only, never widened to also require contactEmail.`,
  );
  assert(
    sentVendorPaymentConfirmations.length === 0,
    `[${label}] expected ZERO vendor receipts when contactEmail is ${JSON.stringify(contactEmailValue)} -- got ${sentVendorPaymentConfirmations.length}. There is no real address to send to.`,
  );

  // Exactly one error line should reference the missing-email case, and it must name ONLY the
  // submission id -- never businessName/contactPersonName/an email address.
  const missingEmailErrors = capturedErrors.filter((args) =>
    args.some((a) => typeof a === 'string' && /contactEmail|receipt not sent/i.test(a)),
  );
  assert(
    missingEmailErrors.length === 1,
    `[${label}] expected exactly 1 console.error naming the missing-contactEmail case, got ${missingEmailErrors.length}. Captured error calls: ${JSON.stringify(capturedErrors)}`,
  );
  if (missingEmailErrors.length === 1) {
    const flatArgs = JSON.stringify(missingEmailErrors[0]);
    assert(
      flatArgs.includes(vendorSubmissionId),
      `[${label}] the missing-contactEmail error log must name the vendorSubmissionId ('${vendorSubmissionId}') so the gap is diagnosable -- got ${flatArgs}`,
    );
    assert(
      !containsSubmittedPii(flatArgs, { businessName: BUSINESS_NAME, contactPersonName: CONTACT_PERSON }),
      `[${label}] the missing-contactEmail error log must NEVER include businessName/contactPersonName/an email address (POPIA-relevant submitted PII) -- got ${flatArgs}`,
    );
  }
}

// Scenario 1: contactEmail entirely absent-as-blank (empty string) -- the realistic Firestore
// shape for "field present but never filled in".
await runScenario('sub-empty-email', '', 'empty-string contactEmail');

// Scenario 2: contactEmail is whitespace-only. Called out explicitly by the team lead as the
// case most likely to be broken by a future refactor, since @dev's real implementation is
// `submission.contactEmail?.trim() || null` -- a future edit that drops the `.trim()` (e.g.
// simplifies it to `submission.contactEmail || null`) would treat a whitespace-only value as a
// real, truthy address and would send the vendor receipt to `'   '`, silently failing at the
// mailer instead of being caught here.
await runScenario('sub-whitespace-email', '   ', 'whitespace-only contactEmail');

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: a settled order whose submission has businessName+contactPersonName but an empty OR ' +
    'whitespace-only contactEmail still fires the admin notice exactly once, fires zero vendor ' +
    'receipts, still acks 200 and settles to paid, and logs exactly one error naming only the ' +
    'submission id -- no PII, no email address.',
);
process.exit(0);
