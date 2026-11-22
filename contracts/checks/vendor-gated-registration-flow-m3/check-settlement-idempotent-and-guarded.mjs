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
const { confirmNotificationCalls, payfastProvider } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');

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
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';
const ORDERS = '../../../lib/vendor-stand-orders.ts';

const { POST: initiatePost } = await import(INITIATE);
const { POST: payfastItnPost } = await import(PAYFAST_ITN);
const { POST: ozowItnPost } = await import(OZOW_ITN);
const { mintVendorStandPaymentToken } = await import(TOKEN);
const { buildVendorStandOrderReference } = await import(ORDERS);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

// vendor-stand-early-bird-pricing (M1/F1) replaced the flat, settable VENDOR_STAND_PRICE_ZAR
// with a confirmed R1450-per-stand rate derived from the active show's window -- this check's
// subject (settlement idempotency/guards) is unrelated to pricing, so it just needs a real,
// resolvable show window (regular tier -- past cutoff -- so boothSize-1 amounts are the
// confirmed R1450 = 145000 cents). See contracts/golden/vendor-stand-early-bird-pricing/README.md.
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

// initiate rate-limits per client IP (10 per 10 minutes); each seeded order comes from its own
// fake client so the number of scenarios in this file never trips the limiter.
let seedCounter = 0;

async function seedPendingOrder(vendorSubmissionId, gateway) {
  vendorSubmissions.set(vendorSubmissionId, { status: 'approved', businessName: 'Fynbos Pottery', contactEmail: 'jane@example.com' });
  setActiveGateway(gateway);
  const token = mintToken(vendorSubmissionId);
  const result = await initiatePost(new Request("http://localhost/api/vendors/stand-payment/initiate", { method: "POST", headers: { 'x-forwarded-for': `203.0.113.${(seedCounter += 1)}` }, body: JSON.stringify(({ token, boothSize: 1 })) }));
  if (result.status !== 200) throw new Error(`fixture setup failed: initiate returned ${result.status}`);
  // Initiate mints a per-attempt id (commit dde56d6a); settlement only accepts a notification whose
  // reference echoes it back (`VSO-<id>::<attemptId>`), exactly as a real gateway does.
  const attemptId = vendorStandOrders.get(vendorSubmissionId)?.attemptId;
  if (!attemptId) throw new Error('fixture setup failed: initiate stored no attemptId on the order');
  return buildVendorStandOrderReference(vendorSubmissionId, attemptId);
}

async function callItn(post, payload) {
  const res = await post(new Request("http://localhost/itn", { method: "POST", body: JSON.stringify(payload) }));
  return { status: res.status, body: await res.json() };
}

// =============================================================================================
// 1. Duplicate notification -- settles once, second call produces ZERO additional writes.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
const dupReference = await seedPendingOrder('sub-dup', 'payfast');
// Reset the spy AFTER setup -- initiate's own createdAt: Timestamp.now() call must not be
// counted against the settlement-specific assertion below.
timestampNowCallCount = 0;

const paidNotification = { reference: dupReference, rawStatus: 'paid', grossAmountCents: 145000, gatewayPaymentId: 'pf-1' };
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
const tamperReference = await seedPendingOrder('sub-tamper', 'payfast');

const tampered = { reference: tamperReference, rawStatus: 'paid', grossAmountCents: 1, gatewayPaymentId: 'pf-2' };
await callItn(payfastItnPost, tampered);
assert(vendorStandOrders.get('sub-tamper')?.status === 'pending', 'a tampered-amount notification must NOT settle the order.');
assert(!vendorSubmissions.get('sub-tamper')?.paymentReceived, 'paymentReceived must stay unset on a tampered-amount notification.');

// =============================================================================================
// 3. Cross-gateway guard, both directions.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
const cross1Reference = await seedPendingOrder('sub-cross-1', 'payfast');
await callItn(ozowItnPost, { reference: cross1Reference, rawStatus: 'paid', grossAmountCents: 145000, gatewayPaymentId: 'oz-1' });
assert(vendorStandOrders.get('sub-cross-1')?.status === 'pending', 'an Ozow notification must not be able to settle a PayFast-created order.');

resetAllCollections();
resetPaymentsFixture();
const cross2Reference = await seedPendingOrder('sub-cross-2', 'ozow');
await callItn(payfastItnPost, { reference: cross2Reference, rawStatus: 'paid', grossAmountCents: 145000, gatewayPaymentId: 'pf-3' });
assert(vendorStandOrders.get('sub-cross-2')?.status === 'pending', 'a PayFast notification must not be able to settle an Ozow-created order.');

// =============================================================================================
// 4. Both-or-neither: order and submission never disagree about paid state.
// =============================================================================================
resetAllCollections();
resetPaymentsFixture();
const atomicReference = await seedPendingOrder('sub-atomic', 'payfast');
await callItn(payfastItnPost, { reference: atomicReference, rawStatus: 'paid', grossAmountCents: 145000, gatewayPaymentId: 'pf-4' });
const orderPaid = vendorStandOrders.get('sub-atomic')?.status === 'paid';
const submissionPaid = vendorSubmissions.get('sub-atomic')?.paymentReceived === true;
assert(
  orderPaid === submissionPaid,
  `order and submission disagree about paid state after settlement (order paid=${orderPaid}, submission paymentReceived=${submissionPaid}) -- both must move together or neither moves.`,
);
assert(orderPaid && submissionPaid, 'expected both the order and the submission to have settled to paid.');

// =============================================================================================
// 5. Each guard copy is proven on its own. settle() checks gateway / status / attempt / amount
//    TWICE: once on a non-transactional pre-read (before the confirm round trip) and again inside
//    db.runTransaction (the copy that actually protects against a race). Sections 1-3 alone pass
//    if EITHER copy is deleted, because the surviving copy rejects the same input.
// =============================================================================================

// 5a. Pre-read copy: a notification it must reject never spends a confirm round trip. With only
//     the in-transaction copy left the order still stays unsettled, but confirm WOULD be called.
const GUARD_PAID = { rawStatus: 'paid', grossAmountCents: 145000 };

resetAllCollections();
resetPaymentsFixture();
const preCrossRef = await seedPendingOrder('sub-pre-cross', 'payfast');
await callItn(ozowItnPost, { reference: preCrossRef, ...GUARD_PAID, gatewayPaymentId: 'oz-pre' });
assert(confirmNotificationCalls.length === 0, 'pre-read gateway guard missing: a cross-gateway notification reached confirmNotification().');

resetAllCollections();
resetPaymentsFixture();
const preStatusRef = await seedPendingOrder('sub-pre-status', 'payfast');
await callItn(payfastItnPost, { reference: preStatusRef, ...GUARD_PAID, gatewayPaymentId: 'pf-pre-1' });
const confirmCallsAfterSettle = confirmNotificationCalls.length;
await callItn(payfastItnPost, { reference: preStatusRef, ...GUARD_PAID, gatewayPaymentId: 'pf-pre-1' });
assert(confirmNotificationCalls.length === confirmCallsAfterSettle, 'pre-read status guard missing: a duplicate notification for a settled order reached confirmNotification().');

resetAllCollections();
resetPaymentsFixture();
const preAttemptRef = await seedPendingOrder('sub-pre-attempt', 'payfast');
await callItn(payfastItnPost, {
  reference: buildVendorStandOrderReference('sub-pre-attempt', 'stale-attempt-id'),
  ...GUARD_PAID,
  gatewayPaymentId: 'pf-pre-2',
});
assert(preAttemptRef && confirmNotificationCalls.length === 0, 'pre-read attempt guard missing: a stale-attempt notification reached confirmNotification().');

resetAllCollections();
resetPaymentsFixture();
const preAmountRef = await seedPendingOrder('sub-pre-amount', 'payfast');
await callItn(payfastItnPost, { reference: preAmountRef, rawStatus: 'paid', grossAmountCents: 1, gatewayPaymentId: 'pf-pre-3' });
assert(confirmNotificationCalls.length === 0, 'pre-read amount guard missing: a tampered-amount notification reached confirmNotification().');

// 5b. In-transaction copy: simulate a race. The stored order passes every pre-read guard, then
//     changes DURING the confirm round trip (after the pre-read, before the transaction reads),
//     so only the in-transaction re-check can reject. Each case must leave the order untouched
//     and must not reach the paid-transition write (Timestamp.now() never called).
const originalConfirm = payfastProvider.confirmNotification;
async function raceDuringConfirm(label, mutateOrder, expectedStatus) {
  resetAllCollections();
  resetPaymentsFixture();
  const raceId = `sub-race-${label}`;
  const reference = await seedPendingOrder(raceId, 'payfast');
  payfastProvider.confirmNotification = async (notification) => {
    Object.assign(vendorStandOrders.get(raceId), mutateOrder);
    return originalConfirm.call(payfastProvider, notification);
  };
  timestampNowCallCount = 0;
  try {
    await callItn(payfastItnPost, { reference, ...GUARD_PAID, gatewayPaymentId: `pf-race-${label}` });
  } finally {
    payfastProvider.confirmNotification = originalConfirm;
  }
  assert(confirmNotificationCalls.length === 1, `race "${label}" setup: expected the notification to pass the pre-read guards and reach confirmNotification() once, got ${confirmNotificationCalls.length}.`);
  assert(vendorStandOrders.get(raceId)?.status === expectedStatus, `in-transaction ${label} guard missing: order status changed from "${expectedStatus}" after a race.`);
  assert(timestampNowCallCount === 0, `in-transaction ${label} guard missing: the paid-transition write ran after the order changed mid-flight.`);
  assert(!vendorSubmissions.get(raceId)?.paymentReceived, `in-transaction ${label} guard missing: paymentReceived flipped after the order changed mid-flight.`);
}

await raceDuringConfirm('gateway', { gateway: 'ozow' }, 'pending');
await raceDuringConfirm('status', { status: 'paid' }, 'paid');
await raceDuringConfirm('attempt', { attemptId: 'superseding-attempt-id' }, 'pending');
await raceDuringConfirm('amount', { amount: 999 }, 'pending');

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: settlement settles once and produces zero additional writes on a duplicate ' +
    'notification, refuses a tampered amount, refuses a cross-gateway notification in both ' +
    'directions, enforces each guard both before confirm and again inside the transaction ' +
    '(simulated mid-flight race), and always moves the order and submission together, never one without the ' +
    'other.',
);
process.exit(0);
