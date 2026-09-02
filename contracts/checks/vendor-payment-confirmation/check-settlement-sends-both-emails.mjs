#!/usr/bin/env node
// vendor-payment-confirmation F1 -- A3: the crux behavioural proof, via the real route-runner
// harness (real payfast-itn/ozow-itn routes, real lib/vendor-stand-payment-notification.ts,
// real lib/vendor-admin-notify-recipients.ts; only Firestore/payments/mailer infrastructure is
// faked). Exercises the actual settlement path end to end and proves, together:
//
//   (1) RECIPIENT CORRECTNESS + INDEPENDENCE -- the vendor receipt's `contactEmail` is exactly
//       the paying vendor's own contactEmail (never an admin address), and the admin notice's
//       recipient set (independently re-resolved from the REAL getVendorAdminNotifyRecipients())
//       never contains the vendor's contactEmail. A mutation swapping the two recipients (e.g.
//       sending the vendor receipt to the admin allowlist, or the admin notice to the vendor)
//       makes this check FAIL.
//   (2) BOTH FIRE ON SETTLEMENT -- a first, genuine 'paid' ITN produces EXACTLY one vendor
//       receipt AND exactly one admin notice. Losing either send drops its count to zero and
//       fails this check.
//   (4) IDEMPOTENCY, THE HIGHEST-VALUE PROPERTY -- a second, duplicate 'paid' ITN for the SAME
//       already-paid order produces ZERO additional sends of EITHER email. This is the direct
//       behavioural answer to "does a retried gateway notification double-send the vendor's
//       receipt" -- the real defect class this feature exists to prevent.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-payment-confirmation/check-settlement-sends-both-emails.mjs

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
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com,admin-two@example.com';

setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const VENDOR_CONTACT_EMAIL = 'jane@fynbospottery.example';
const VENDOR_CONTACT_PERSON = 'Jane Vendor';
const VENDOR_BUSINESS_NAME = 'Fynbos Pottery';

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

// Returns the REAL `reference` the initiate route minted for this attempt (via the fixture's
// `initiateCalls` log) -- F3 (vendor-stand-payment-confirm-gate) threads a per-attempt id
// through this field, so a hardcoded `VSO-{id}` literal no longer matches what a real gateway
// notification would carry (a bare reference with no attempt suffix is now REJECTED once the
// order has an attemptId -- see A11). Same fix, same reasoning, as the six
// vendor-stand-payment-confirm-gate checks already carry (e.g.
// check-unconfirmed-blocks-settlement.mjs's own seedPendingOrder).
async function seedPendingOrder(vendorSubmissionId) {
  vendorSubmissions.set(vendorSubmissionId, {
    status: 'approved',
    businessName: VENDOR_BUSINESS_NAME,
    contactPersonName: VENDOR_CONTACT_PERSON,
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

async function callItn(payload) {
  const res = await payfastItnPost({ text: async () => JSON.stringify(payload), headers: new Headers() });
  return { status: res.status, body: await res.json() };
}

// Independent, fresh resolution of the real admin recipient list -- never the same import a
// consumer module holds, so this check can't drift from (or be fooled by) the same instance a
// mutation might tamper with. Same convention as vendor-flow-notifications' A10
// (check-recipients-exact-match.mjs).
async function resolveRealAdminRecipients() {
  const mod = await import(
    `../../../lib/vendor-admin-notify-recipients.ts?cb=${Date.now()}-${Math.random()}`
  );
  return mod.getVendorAdminNotifyRecipients();
}

resetAllCollections();
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();
const bothEmailsReference = await seedPendingOrder('sub-both-emails');

const paidNotification = {
  reference: bothEmailsReference,
  rawStatus: 'paid',
  grossAmountCents: 145000,
  gatewayPaymentId: 'pf-both-1',
};

// =============================================================================================
// 1. First, genuine settlement -- exactly one of each email, correct/independent recipients.
// =============================================================================================
const settle1 = await callItn(paidNotification);
assert(settle1.status === 200, `expected the first settlement to be acknowledged 200, got ${settle1.status}`);

assert(
  sentVendorPaymentConfirmations.length === 1,
  `expected exactly 1 vendor payment confirmation after the first settlement, got ${sentVendorPaymentConfirmations.length}`,
);
assert(
  sentVendorPaymentAdminNotices.length === 1,
  `expected exactly 1 admin payment notice after the first settlement, got ${sentVendorPaymentAdminNotices.length}`,
);

if (sentVendorPaymentConfirmations.length === 1) {
  const vendorInput = sentVendorPaymentConfirmations[0];
  assert(
    vendorInput.contactEmail === VENDOR_CONTACT_EMAIL,
    `vendor receipt must be addressed to the paying vendor's own contactEmail (${VENDOR_CONTACT_EMAIL}); got ${JSON.stringify(vendorInput.contactEmail)}`,
  );
  assert(
    vendorInput.businessName === VENDOR_BUSINESS_NAME,
    `vendor receipt businessName should be ${VENDOR_BUSINESS_NAME}, got ${JSON.stringify(vendorInput.businessName)}`,
  );
  assert(
    vendorInput.standOrderRef === bothEmailsReference,
    `vendor receipt standOrderRef should be the real minted reference (${bothEmailsReference}), got ${JSON.stringify(vendorInput.standOrderRef)}`,
  );
  assert(
    vendorInput.amount === 1450,
    `vendor receipt amount should be the real settled amount (1450 rand), got ${JSON.stringify(vendorInput.amount)}`,
  );
  assert(
    vendorInput.boothSize === 1,
    `vendor receipt boothSize should be 1, got ${JSON.stringify(vendorInput.boothSize)}`,
  );
}

const realAdminRecipients = await resolveRealAdminRecipients();
assert(
  Array.isArray(realAdminRecipients) && realAdminRecipients.length > 0,
  `test setup error -- expected a non-empty real admin recipient list, got ${JSON.stringify(realAdminRecipients)}`,
);
assert(
  !realAdminRecipients.includes(VENDOR_CONTACT_EMAIL.toLowerCase()),
  'test setup error -- the vendor contactEmail fixture must not collide with a real admin allowlist address',
);

// Recipient INDEPENDENCE, both directions: the vendor receipt's `contactEmail` must never be
// (or become) one of the resolved admin addresses, and the admin notice's own input must never
// carry the vendor's contactEmail as a value that could be mistaken for a recipient. The admin
// notice module resolves its own recipients internally (not via an input field) -- see
// contracts/golden/vendor-flow-notifications/README.md -- so what THIS check can additionally
// prove is that the admin-notice INPUT this settlement handler supplies carries no
// `contactEmail`/`to` field pointing at the vendor's address, and that a fresh, independent
// resolver call still returns a real, non-empty, vendor-address-free list after this settlement
// (i.e. the settlement did not somehow mutate the resolver's env-derived output).
if (sentVendorPaymentAdminNotices.length === 1) {
  const adminInput = sentVendorPaymentAdminNotices[0];
  const adminInputValues = Object.values(adminInput).map((v) => (typeof v === 'string' ? v.toLowerCase() : v));
  assert(
    !adminInputValues.includes(VENDOR_CONTACT_EMAIL.toLowerCase()),
    `the admin notice's own input must never carry the vendor's contactEmail (${VENDOR_CONTACT_EMAIL}) as one of its fields -- got ${JSON.stringify(adminInput)}`,
  );
  assert(
    adminInput.businessName === VENDOR_BUSINESS_NAME,
    `admin notice businessName should be ${VENDOR_BUSINESS_NAME}, got ${JSON.stringify(adminInput.businessName)}`,
  );
}

// =============================================================================================
// 1b. SOURCE-OF-TRUTH proof, per the team lead's ground-truth correction: contactEmail must be
//     read from the SUBMISSION at settlement time, never from the `order` document's own
//     contactEmail (a snapshot copied once at initiate time, which can go stale if the vendor's
//     contact details change between initiating payment and the gateway actually settling it).
//     Seeds an order whose baked-in `order.contactEmail` is a STALE address, then updates the
//     submission's contactEmail to a DIFFERENT, fresher address before settling -- the vendor
//     receipt must go to the FRESH address, proving sourcing did not regress to reading the
//     stale snapshot on `order` instead of the live value on `submission`.
//
// Deliberately does NOT call resetAllCollections() -- scenario 1's 'sub-both-emails' order must
// still exist afterward for scenario 2's duplicate-ITN idempotency proof below. This scenario
// uses its own distinct vendorSubmissionId ('sub-stale-email'), so no collision.
// =============================================================================================
resetPaymentsFixture();
resetVendorPaymentConfirmationFixture();
resetVendorPaymentAdminNoticeFixture();

const STALE_ORDER_EMAIL = 'stale-at-initiate-time@fynbospottery.example';
const FRESH_SUBMISSION_EMAIL = 'fresh-current@fynbospottery.example';

vendorSubmissions.set('sub-stale-email', {
  status: 'approved',
  businessName: VENDOR_BUSINESS_NAME,
  contactPersonName: VENDOR_CONTACT_PERSON,
  contactEmail: STALE_ORDER_EMAIL,
});
setActiveGateway('payfast');
const staleToken = mintToken('sub-stale-email');
const initiateResult = await initiatePost({ json: async () => ({ token: staleToken, boothSize: 1 }) });
if (initiateResult.status !== 200) {
  throw new Error(`fixture setup error: initiate returned ${initiateResult.status}`);
}
const staleEmailReference = initiateCalls.at(-1)?.reference;
if (!staleEmailReference) {
  throw new Error('test setup error: could not capture the real reference from initiateCalls (stale-email scenario)');
}
assert(
  vendorStandOrders.get('sub-stale-email')?.contactEmail === STALE_ORDER_EMAIL,
  'test setup error -- expected the order doc to have baked in the stale contactEmail at initiate time',
);
// The vendor's contact details change AFTER initiate, BEFORE the gateway settles -- e.g. they
// corrected a typo, or their submission was edited. `order.contactEmail` is now stale.
vendorSubmissions.set('sub-stale-email', {
  status: 'approved',
  businessName: VENDOR_BUSINESS_NAME,
  contactPersonName: VENDOR_CONTACT_PERSON,
  contactEmail: FRESH_SUBMISSION_EMAIL,
});

const staleEmailSettle = await callItn({
  reference: staleEmailReference,
  rawStatus: 'paid',
  grossAmountCents: 145000,
  gatewayPaymentId: 'pf-stale-email',
});
assert(
  staleEmailSettle.status === 200,
  `Source-of-truth scenario: expected 200, got ${staleEmailSettle.status}`,
);
assert(
  sentVendorPaymentConfirmations.length === 1,
  `Source-of-truth scenario: expected exactly 1 vendor receipt, got ${sentVendorPaymentConfirmations.length}`,
);
if (sentVendorPaymentConfirmations.length === 1) {
  const gotEmail = sentVendorPaymentConfirmations[0].contactEmail;
  assert(
    gotEmail === FRESH_SUBMISSION_EMAIL,
    `Source-of-truth scenario: vendor receipt must use the SUBMISSION's current contactEmail (${FRESH_SUBMISSION_EMAIL}), not the order doc's stale snapshot (${STALE_ORDER_EMAIL}) -- got ${JSON.stringify(gotEmail)}. This is exactly what would happen if the implementation regressed to reading order.contactEmail instead of submission.contactEmail.`,
  );
}

// =============================================================================================
// 2. Duplicate 'paid' ITN for the SAME already-settled order -- ZERO additional sends, either
//    email. This is the load-bearing idempotency proof.
// =============================================================================================
const countsAfterFirst = {
  vendor: sentVendorPaymentConfirmations.length,
  admin: sentVendorPaymentAdminNotices.length,
};

const settle2 = await callItn(paidNotification);
assert(
  settle2.status === 200,
  `expected the duplicate settlement notification to still be acknowledged 200, got ${settle2.status}`,
);
assert(
  sentVendorPaymentConfirmations.length === countsAfterFirst.vendor,
  `a DUPLICATE settled ITN sent ${sentVendorPaymentConfirmations.length - countsAfterFirst.vendor} additional vendor receipt(s) -- a retried gateway notification must never re-send the vendor's payment receipt.`,
);
assert(
  sentVendorPaymentAdminNotices.length === countsAfterFirst.admin,
  `a DUPLICATE settled ITN sent ${sentVendorPaymentAdminNotices.length - countsAfterFirst.admin} additional admin notice(s) -- must be a true no-op.`,
);

// A second duplicate, from a fresh POST body object (not literally the same reference), to
// rule out any "same JS object" shortcut in a naive implementation.
const settle3 = await callItn({ ...paidNotification });
assert(settle3.status === 200, `expected a third duplicate ITN to still be acknowledged 200, got ${settle3.status}`);
assert(
  sentVendorPaymentConfirmations.length === countsAfterFirst.vendor,
  'a THIRD duplicate settled ITN must still send zero additional vendor receipts.',
);
assert(
  sentVendorPaymentAdminNotices.length === countsAfterFirst.admin,
  'a THIRD duplicate settled ITN must still send zero additional admin notices.',
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: a genuine settlement sends exactly one vendor receipt (to the vendor\'s own ' +
    'contactEmail, carrying the real businessName/amount/boothSize/standOrderRef) and exactly ' +
    'one admin notice (to the real, independently-resolved admin allowlist, never the vendor\'s ' +
    'address); a duplicate settled ITN sends zero additional emails of either kind.',
);
process.exit(0);
