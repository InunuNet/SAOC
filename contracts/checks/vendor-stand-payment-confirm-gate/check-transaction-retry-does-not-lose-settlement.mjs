#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F6 -- REWRITTEN 2026-09-02. The original version of this
// check asserted `confirmNotificationCalls.length === 2` ("once per simulated transaction
// attempt") as an unconditional SETUP precondition, evaluated before the crux property at all.
// That encoded the DEFECTIVE topology (confirm inside the retried transaction, called once per
// Firestore attempt) as a requirement. The team lead mandated fix (a) -- confirm now runs
// EXACTLY ONCE, entirely OUTSIDE and BEFORE `db.runTransaction(...)` (see
// lib/vendor-stand-payment-notification.ts's `settle()`, the golden README's "F6") -- under
// which a Firestore retry replays only the confirm-free write transaction, so confirm is never
// called twice. The old check therefore failed on its OWN setup assertion while the real
// security property held (order settles 'paid', HTTP 200, confirm called once) -- a false
// negative caused by the check assuming the wrong (rejected) fix shape, not a real defect.
//
// This version asserts the PROPERTY, not the topology:
//
//   1. THE CRUX, unchanged and non-negotiable -- the entire reason F6 exists: a genuine payment
//      must NEVER be left unsettled while the handler acknowledges HTTP 200. That combination
//      means the gateway believes its notification was handled and stops retrying a payment
//      that actually happened -- permanent, silent loss.
//   2. confirmNotification() must be called EXACTLY ONCE per delivery, even when the settlement
//      transaction is retried under Firestore contention. This is now a genuine, load-bearing
//      property specific to fix (a): it is what STRUCTURALLY closes off F6, by construction --
//      a Firestore retry cannot re-invoke an external call that no longer lives inside the
//      retried section. Asserting "exactly one call" locks that topology down, so a future edit
//      that moves confirmNotification() back inside `db.runTransaction(...)` (reintroducing F6,
//      even if it looks like a harmless simplification) is caught HERE, not rediscovered by
//      another Codex pass.
//   3. Despite the RETRY actually occurring (the write-only settlement transaction still
//      replays under simulated contention -- this check does not stop simulating retries just
//      because confirm moved outside them), the order must still converge correctly: settles to
//      'paid', HTTP 200, both downstream emails fire exactly once. A retry that merely doesn't
//      lose the payment but also doesn't ever actually commit would be an equally real bug this
//      check would otherwise miss.
//
// Via the real route-runner harness (real initiate route, real payfast-itn route, real
// lib/vendor-stand-payment-notification.ts), with the SAME two harness additions the original
// version of this check introduced: `simulateTransactionRetries(1)`
// (contracts/harness/route-runner/fixture-firestore.mjs -- replays the NEXT db.runTransaction
// callback once, discarding that attempt's writes while letting non-Firestore side effects run
// for real, before the final committing attempt whose writes land) and
// `setConfirmNotificationResultSequence([{confirmed:true},{confirmed:false,reason:...}])`
// (contracts/harness/route-runner/fixture-payments.mjs -- lets successive confirmNotification()
// calls within ONE delivery see different results). Under fix (a), only entry [0] is EVER
// consumed (exactly one call happens, before the retried transaction even starts) -- the second
// entry existing in the sequence is deliberate: it is what would have been consumed by a SECOND
// confirm call if the old, defective topology were reintroduced, which is exactly what the
// RED-verification below (a deliberately reverted implementation) demonstrates.
//
// RED-verified against the CURRENT (fixed) implementation (2026-09-02): PASSES, exit 0.
// RED-verified against a DELIBERATELY REVERTED implementation (confirm moved back inside
// db.runTransaction, matching the pre-F6/defective shape) (2026-09-02): FAILS, exit 1 -- both
// the "exactly once" assertion (2 calls observed) and the crux silent-loss assertion (order
// 'pending' with HTTP 200) fail, naming the exact combination F6 exists to prevent. See the
// golden README's "F6" for the full before/after evidence and exit codes.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-payment-confirm-gate/check-transaction-retry-does-not-lose-settlement.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const {
  resetPaymentsFixture,
  initiateCalls,
  confirmNotificationCalls,
  setConfirmNotificationResultSequence,
} = require('../../harness/route-runner/fixture-payments.mjs');
const { simulateTransactionRetries } = require('../../harness/route-runner/fixture-firestore.mjs');
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

const VENDOR_SUBMISSION_ID = 'sub-transaction-retry';

function mintToken() {
  return mintVendorStandPaymentToken({ vendorSubmissionId: VENDOR_SUBMISSION_ID, secret: TEST_SECRET, now: new Date() }).token;
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
// 1. Vendor initiates -- order becomes 'pending'.
// =============================================================================================
const token = mintToken();
const initiateResult = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
if (initiateResult.status !== 200) {
  throw new Error(`test setup error: initiate returned ${initiateResult.status}: ${JSON.stringify(await initiateResult.json())}`);
}
const reference = initiateCalls.at(-1)?.reference;
if (!reference) {
  throw new Error('test setup error: could not capture the real reference from initiateCalls');
}

// =============================================================================================
// 2. ONE genuine 'paid' delivery, under a SIMULATED Firestore retry of the settlement
// transaction. The sequence's SECOND entry ({confirmed:false}) exists specifically to expose
// the old, defective topology if it is ever reintroduced (see header comment) -- under the
// current, correct topology it is never consumed at all, because confirm is called exactly
// once, before the retried transaction even opens.
// =============================================================================================
simulateTransactionRetries(1);
setConfirmNotificationResultSequence([
  { confirmed: true },
  { confirmed: false, reason: 'request-failed' },
]);

const delivery = await callItn({
  reference,
  rawStatus: 'paid',
  grossAmountCents: 145000,
  gatewayPaymentId: 'pf-transaction-retry-1',
});

// -- Property 2: confirm called EXACTLY ONCE per delivery, even under a simulated transaction
// retry. This is the structural guarantee fix (a) provides -- see header comment for why this
// is now asserted directly rather than left implicit.
assert(
  confirmNotificationCalls.length === 1,
  `confirmNotification() must be called EXACTLY ONCE per delivery, even when the settlement transaction is retried under contention -- got ${confirmNotificationCalls.length} call(s). More than one call means confirmNotification() is (still, or again) running inside the retried transactional section, which is precisely the topology that reintroduces F6's silent-loss defect.`,
);

// -- Property 1: THE CRUX. A genuine payment must never be left unsettled while acknowledged
// 200 -- see header comment.
const silentlyLost = vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'pending' && delivery.status === 200;
assert(
  !silentlyLost,
  `a genuine payment must never be BOTH left unsettled AND acknowledged 200 -- that combination means the gateway stops retrying a payment that actually happened, permanently losing it. Got order status ${JSON.stringify(vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status)} with HTTP ${delivery.status}.`,
);

// -- Property 3: the retry actually occurred and the settlement still converges correctly --
// not merely "did not lose the payment" but "genuinely completed it."
assert(delivery.status === 200, `expected the delivery to be acknowledged 200, got ${delivery.status}`);
assert(
  vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status === 'paid',
  `expected the order to settle to 'paid' despite the simulated transaction retry -- got status ${JSON.stringify(vendorStandOrders.get(VENDOR_SUBMISSION_ID)?.status)}`,
);
assert(
  vendorSubmissions.get(VENDOR_SUBMISSION_ID)?.paymentReceived === true,
  'vendorSubmissions.paymentReceived must flip true once the order settles despite the simulated retry',
);
assert(
  sentVendorPaymentConfirmations.length === 1,
  `expected exactly 1 vendor payment confirmation once the order settles despite the simulated retry, got ${sentVendorPaymentConfirmations.length}`,
);
assert(
  sentVendorPaymentAdminNotices.length === 1,
  `expected exactly 1 admin payment notice once the order settles despite the simulated retry, got ${sentVendorPaymentAdminNotices.length}`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: confirmNotification() is called exactly once per delivery even under a simulated ' +
    'Firestore transaction retry (the structural guarantee that closes off F6), the retried ' +
    'settlement transaction still converges correctly (order settles paid, both emails fire), ' +
    'and a genuine payment is never both left unsettled and acknowledged 200.',
);
process.exit(0);
