#!/usr/bin/env node
// vendor-gated-registration-flow M3/F31 (A61) -- behavioural proof, via the route-runner
// harness, that settlement (lib/vendor-stand-payment-notification.ts, exercised through the
// real payfast-itn/ozow-itn routes) is idempotent, amount-guarded, and cross-gateway-guarded.
// This is the exact "exercise the real transaction with two duplicate notifications and a
// tampered amount" proof the golden README's closing paragraph on A50's own history calls
// for -- a source-order check that merely reads for the right function calls is NOT
// sufficient for money-handling logic on this mission.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-gated-registration-flow-m3/check-settlement-idempotent-and-guarded.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections, FakeTimestamp } = require(
  '../../harness/route-runner/store.mjs',
);
const { resetPaymentsFixture } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');

// `applyPatch` (fixture-firestore.mjs) mutates the stored object's fields IN PLACE, so a
// duplicate settlement that re-writes the SAME status/gatewayPaymentId values (differing only
// in a fresh paidAt timestamp) can land within the same JS-clock millisecond and produce a
// JSON.stringify-identical snapshot even if the write codepath genuinely re-executed --
// verified directly: with the idempotency guard removed, the snapshot-equality assertion below
// alone passed vacuously. A call-count spy on FakeTimestamp.now() is the robust proof instead:
// the settlement handler calls Timestamp.now() exactly once, ONLY on the branch that actually
// performs the paid-transition write -- a duplicate notification must NOT increment this
// counter at all.
let timestampNowCallCount = 0;
const originalFakeTimestampNow = FakeTimestamp.now;
FakeTimestamp.now = function spyingNow(...args) {
  timestampNowCallCount += 1;
  return originalFakeTimestampNow.apply(this, args);
};

const INITIATE = '../../../app/api/vendors/stand-payment/initiate/route.ts';
const PAYFAST_ITN = '../../../app/api/vendors/stand-payment/payfast-itn/route.ts';
const OZOW_ITN = '../../../app/api/vendors/stand-payment/ozow-itn/route.ts';
const PRICING = '../../../lib/vendor-stand-pricing.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const { POST: initiatePost } = await import(INITIATE);
const { POST: payfastItnPost } = await import(PAYFAST_ITN);
const { POST: ozowItnPost } = await import(OZOW_ITN);
const pricing = await import(PRICING);
const { mintVendorStandPaymentToken } = await import(TOKEN);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

pricing.VENDOR_STAND_PRICE_ZAR[1] = 1500;
pricing.VENDOR_STAND_PRICE_ZAR[2] = 2800;
pricing.VENDOR_STAND_PRICE_ZAR[3] = 3900;

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

async function seedPendingOrder(vendorSubmissionId, gateway) {
  vendorSubmissions.set(vendorSubmissionId, { status: 'approved', businessName: 'Fynbos Pottery', contactEmail: 'jane@example.com' });
  setActiveGateway(gateway);
  const token = mintToken(vendorSubmissionId);
  const result = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
  if (result.status !== 200) throw new Error(`fixture setup failed: initiate returned ${result.status}`);
}

async function callItn(post, payload) {
  const res = await post({ text: async () => JSON.stringify(payload), headers: new Headers() });
  return { status: res.status, body: await res.json() };
}

// =============================================================================================
// 1. Duplicate notification -- settles once, second call produces ZERO additional writes.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
await seedPendingOrder('sub-dup', 'payfast');
// Reset the spy AFTER setup -- initiate's own createdAt: Timestamp.now() call must not be
// counted against the settlement-specific assertion below.
timestampNowCallCount = 0;

const paidNotification = { reference: 'VSO-sub-dup', rawStatus: 'paid', grossAmountCents: 150000, gatewayPaymentId: 'pf-1' };
const settle1 = await callItn(payfastItnPost, paidNotification);
assert(settle1.status === 200, `expected first settlement to be acknowledged 200, got ${settle1.status}`);
assert(vendorStandOrders.get('sub-dup')?.status === 'paid', 'order should flip to paid on first settlement.');
assert(vendorSubmissions.get('sub-dup')?.paymentReceived === true, 'vendorSubmissions.paymentReceived should flip true in the SAME settlement.');

const orderSnapshotAfterFirst = JSON.stringify(vendorStandOrders.get('sub-dup'));
const submissionSnapshotAfterFirst = JSON.stringify(vendorSubmissions.get('sub-dup'));
const timestampCallsAfterFirst = timestampNowCallCount;
assert(timestampCallsAfterFirst === 1, `expected exactly one Timestamp.now() call for the first, genuine settlement, got ${timestampCallsAfterFirst}`);

const settle2 = await callItn(payfastItnPost, paidNotification);
assert(settle2.status === 200, `expected the duplicate notification to still be acknowledged 200, got ${settle2.status}`);
// The definitive, clock-resolution-independent proof: the write codepath (which calls
// Timestamp.now() exactly once) must not have re-executed at all.
assert(
  timestampNowCallCount === timestampCallsAfterFirst,
  `a duplicate settlement notification re-invoked the paid-transition write codepath (Timestamp.now() called ${timestampNowCallCount} times total, expected still ${timestampCallsAfterFirst}) -- must be a true no-op, not merely a re-write of identical values.`,
);
// Secondary sanity check -- the visible document state must also be unchanged.
assert(
  JSON.stringify(vendorStandOrders.get('sub-dup')) === orderSnapshotAfterFirst,
  'a duplicate settlement notification changed the order document\'s visible state.',
);
assert(
  JSON.stringify(vendorSubmissions.get('sub-dup')) === submissionSnapshotAfterFirst,
  'a duplicate settlement notification changed the submission document\'s visible state.',
);

// =============================================================================================
// 2. Tampered amount -- refused, order stays pending, paymentReceived stays unset.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
await seedPendingOrder('sub-tamper', 'payfast');

const tampered = { reference: 'VSO-sub-tamper', rawStatus: 'paid', grossAmountCents: 1, gatewayPaymentId: 'pf-2' };
await callItn(payfastItnPost, tampered);
assert(vendorStandOrders.get('sub-tamper')?.status === 'pending', 'a tampered-amount notification must NOT settle the order.');
assert(!vendorSubmissions.get('sub-tamper')?.paymentReceived, 'paymentReceived must stay unset on a tampered-amount notification.');

// =============================================================================================
// 3. Cross-gateway guard, both directions.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
await seedPendingOrder('sub-cross-1', 'payfast');
await callItn(ozowItnPost, { reference: 'VSO-sub-cross-1', rawStatus: 'paid', grossAmountCents: 150000, gatewayPaymentId: 'oz-1' });
assert(vendorStandOrders.get('sub-cross-1')?.status === 'pending', 'an Ozow notification must not be able to settle a PayFast-created order.');

resetAllCollections();
resetPaymentsFixture();
await seedPendingOrder('sub-cross-2', 'ozow');
await callItn(payfastItnPost, { reference: 'VSO-sub-cross-2', rawStatus: 'paid', grossAmountCents: 150000, gatewayPaymentId: 'pf-3' });
assert(vendorStandOrders.get('sub-cross-2')?.status === 'pending', 'a PayFast notification must not be able to settle an Ozow-created order.');

// =============================================================================================
// 4. Both-or-neither: order and submission never disagree about paid state.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
await seedPendingOrder('sub-atomic', 'payfast');
await callItn(payfastItnPost, { reference: 'VSO-sub-atomic', rawStatus: 'paid', grossAmountCents: 150000, gatewayPaymentId: 'pf-4' });
const orderPaid = vendorStandOrders.get('sub-atomic')?.status === 'paid';
const submissionPaid = vendorSubmissions.get('sub-atomic')?.paymentReceived === true;
assert(
  orderPaid === submissionPaid,
  `order and submission disagree about paid state after settlement (order paid=${orderPaid}, submission paymentReceived=${submissionPaid}) -- both must move together or neither moves.`,
);
assert(orderPaid && submissionPaid, 'expected both the order and the submission to have settled to paid.');

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: settlement settles once and produces zero additional writes on a duplicate ' +
    'notification, refuses a tampered amount, refuses a cross-gateway notification in both ' +
    'directions, and always moves the order and submission together, never one without the ' +
    'other.',
);
process.exit(0);
