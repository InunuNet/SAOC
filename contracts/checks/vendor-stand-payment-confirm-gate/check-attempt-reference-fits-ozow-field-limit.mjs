#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F7 -- another defect IN F3's OWN fix, found by the same
// Codex GPT-5.5 pass. F3 widened the stand-order reference to
// `VSO-{vendorSubmissionId}::{attemptId}` (lib/vendor-stand-orders.ts's
// buildVendorStandOrderReference), with `attemptId` minted as a full `crypto.randomUUID()` (36
// characters including hyphens) in app/api/vendors/stand-payment/initiate/route.ts. For a real
// Firestore auto-generated document id (always exactly 20 characters -- vendorSubmissionId is
// the vendorSubmissions doc id, created via `.add()`), the built reference is
// `VSO-` (4) + 20 + `::` (2) + 36 = 62 characters.
//
// lib/payments/ozow.ts maps this reference DIRECTLY into `TransactionReference` (line ~222).
// That same file's own comment (deriveOzowBankReference's doc comment, ~line 163-169) already
// documents Ozow's field as `String(50)` -- "TransactionReference is unaffected -- it keeps the
// full reference, well within its own 50-char limit," written when the only reference in play
// was the 22-character ticket booking ref. F3's 62-character stand-order reference BREAKS that
// premise -- it is 12 characters OVER Ozow's own documented 50-char cap, for every normal
// approved vendor submission, the moment `activeGateway === 'ozow'`. Ozow either refuses the
// initiate outright, or truncates the value -- and a truncated reference then fails F3's OWN
// attempt-identity match on the notification, turning a real payment into a rejected
// notification.
//
// PayFast is the active gateway today (see adminSettings.activePaymentGateway,
// docs/payment-gateway-selection.md), so nothing is broken in PRODUCTION right now -- this check
// does not claim otherwise. But the Ozow switch is a live pending decision (see
// docs/payment-gateway-selection.md), and this defect fires the moment it flips, silently,
// because nothing today asserts a length bound on this reference against either adapter's
// documented field limits.
//
// SCOPE, explicit: Ozow's BankReference field (also fed the full reference today, via
// deriveOzowBankReference, which only strips the TICKET path's BOOKING_REF_PREFIX and does
// nothing for a `VSO-` reference) is ALREADY over its OWN documented 20-char cap even at the
// pre-F3 length (`VSO-{20-char id}` = 24 chars > 20) -- this is a PRE-EXISTING gap that predates
// F3 and is not introduced by this contract's fix; it is called out here for visibility but is
// NOT asserted by this check, which is scoped to the regression F3 itself introduced
// (TransactionReference's 50-char cap, previously satisfied, now breached). See the golden
// README's "F7" for why BankReference is flagged but out of scope.
//
// Via the real route-runner harness (real initiate route; only Firestore/payments infrastructure
// faked) -- captures the REAL reference the initiate route mints for a vendorSubmissionId of the
// REAL Firestore auto-id length (20 characters, matching production; a shorter id used for
// check-convenience elsewhere in this contract would understate the real-world length and hide
// this defect). Asserts the captured reference's length is within Ozow's documented 50-char
// TransactionReference cap, WITH MARGIN (a length bound with zero headroom is exactly as fragile
// as the bug this check exists to catch -- a future field addition to the id format would
// silently re-breach a bound sized to fit today's shape exactly).
//
// RED-verified live (2026-09-02): FAILS -- captured reference is 62 characters, 12 over the
// 50-char cap and outside the check's own margin.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-attempt-reference-fits-ozow-field-limit.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const { resetPaymentsFixture, initiateCalls } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');
const {
  resetVendorPaymentConfirmationFixture,
} = require('../../harness/route-runner/fixture-vendor-payment-confirmation.mjs');
const {
  resetVendorPaymentAdminNoticeFixture,
} = require('../../harness/route-runner/fixture-vendor-payment-admin-notice.mjs');

const INITIATE = '../../../app/api/vendors/stand-payment/initiate/route.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const { POST: initiatePost } = await import(INITIATE);
const { mintVendorStandPaymentToken } = await import(TOKEN);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com';
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

// A REAL Firestore auto-generated document id is always exactly 20 characters -- this is the
// production shape (vendorSubmissions doc ids are created via `.add()`), not a check
// convenience. Using anything shorter here would understate the real reference length and could
// hide this exact defect.
const FIRESTORE_AUTO_ID_LENGTH = 20;
const VENDOR_SUBMISSION_ID = 'aB3dEfGh1234567890ZZ';
if (VENDOR_SUBMISSION_ID.length !== FIRESTORE_AUTO_ID_LENGTH) {
  throw new Error(
    `test setup error: VENDOR_SUBMISSION_ID must be exactly ${FIRESTORE_AUTO_ID_LENGTH} characters to match a real Firestore auto-id, got ${VENDOR_SUBMISSION_ID.length}`,
  );
}

// Ozow's OWN documented field limit, per lib/payments/ozow.ts's own comment on
// deriveOzowBankReference (~line 163-169): "TransactionReference is ... well within its own
// 50-char limit." This check treats that in-repo documentation as the source of truth for the
// cap, not an externally-asserted number.
const OZOW_TRANSACTION_REFERENCE_LIMIT = 50;
// Deliberate margin -- see header comment. A future field addition to the reference format
// (another `::`-separated segment, a longer id scheme) must have room to grow without silently
// re-breaching the cap the moment it lands.
const REQUIRED_MARGIN = 5;

function mintToken() {
  return mintVendorStandPaymentToken({ vendorSubmissionId: VENDOR_SUBMISSION_ID, secret: TEST_SECRET, now: new Date() }).token;
}

resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
setActiveGateway('payfast'); // the reference format itself does not depend on which gateway is active -- see header "Scope"

vendorSubmissions.set(VENDOR_SUBMISSION_ID, {
  status: 'approved',
  businessName: 'Fynbos Pottery',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@fynbospottery.example',
});

const token = mintToken();
const initiateResult = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
if (initiateResult.status !== 200) {
  throw new Error(`test setup error: initiate returned ${initiateResult.status}: ${JSON.stringify(await initiateResult.json())}`);
}
const reference = initiateCalls.at(-1)?.reference;
if (!reference) {
  throw new Error('test setup error: could not capture the real reference from initiateCalls');
}

assert(
  reference.length <= OZOW_TRANSACTION_REFERENCE_LIMIT - REQUIRED_MARGIN,
  `the real minted reference "${reference}" is ${reference.length} characters -- Ozow's own documented TransactionReference cap is ${OZOW_TRANSACTION_REFERENCE_LIMIT}, and this check requires ${REQUIRED_MARGIN} characters of margin below that (i.e. at most ${OZOW_TRANSACTION_REFERENCE_LIMIT - REQUIRED_MARGIN}), for a real ${FIRESTORE_AUTO_ID_LENGTH}-character Firestore auto-id vendorSubmissionId. The attempt correlator must be shortened.`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `PASS: the real per-attempt reference minted for a production-length (${FIRESTORE_AUTO_ID_LENGTH}-char) ` +
    `vendorSubmissionId stays within Ozow's documented 50-char TransactionReference cap, with ` +
    `${REQUIRED_MARGIN} characters of margin to spare.`,
);
process.exit(0);
