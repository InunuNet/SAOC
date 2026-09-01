#!/usr/bin/env node
// vendor-gated-registration-flow M3/F30 (A60) -- behavioural proof, via the route-runner
// harness, that POST /api/vendors/stand-payment/initiate is transactionally idempotent: two
// concurrent calls for the same vendorSubmissionId produce exactly ONE vendorStandOrders
// document (doc id === vendorSubmissionId, see the golden README "Why the doc id is the
// submission id"); a later legitimate retry overwrites the SAME document; and a call attempted
// after the order reaches 'paid' is refused and leaves the paid document byte-identical.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-gated-registration-flow-m3/check-initiate-is-transactionally-idempotent.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require(
  '../../harness/route-runner/store.mjs',
);
const { resetPaymentsFixture } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');

const INITIATE = '../../../app/api/vendors/stand-payment/initiate/route.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const { POST: initiatePost } = await import(INITIATE);
const { mintVendorStandPaymentToken } = await import(TOKEN);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

// vendor-stand-early-bird-pricing (M1/F1) replaced the flat, settable VENDOR_STAND_PRICE_ZAR
// with a confirmed R1450-per-stand rate derived from the active show's window -- this check's
// subject (transactional idempotency) is unrelated to pricing, so it just needs a real,
// resolvable show window (regular tier -- past cutoff -- so amounts are the confirmed R1450 x
// boothSize figures below) rather than settable price cells. See
// contracts/golden/vendor-stand-early-bird-pricing/README.md.
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

async function callInitiate(token, boothSize) {
  const res = await initiatePost({ json: async () => ({ token, boothSize }) });
  return { status: res.status, body: await res.json() };
}

resetAllCollections();
resetPaymentsFixture();
setActiveGateway('payfast');
vendorSubmissions.set('sub-idem', { status: 'approved', businessName: 'Fynbos Pottery', contactEmail: 'jane@example.com' });
const token = mintToken('sub-idem');

// --- Two concurrent calls: exactly one document ------------------------------------------------
const [first, second] = await Promise.all([callInitiate(token, 1), callInitiate(token, 1)]);
assert(
  first.status === 200 && second.status === 200,
  `expected both concurrent initiate calls to succeed with no unhandled collision, got ${first.status} and ${second.status}`,
);
assert(
  vendorStandOrders.size === 1,
  `expected exactly ONE vendorStandOrders document after two concurrent initiate calls, found ${vendorStandOrders.size}`,
);

// --- Legitimate retry (before payment) overwrites the SAME document ----------------------------
const retry = await callInitiate(token, 3);
assert(retry.status === 200, `expected a legitimate retry to succeed, got ${retry.status}`);
assert(
  vendorStandOrders.size === 1,
  `expected the retry to overwrite the SAME document rather than create a second one, found ${vendorStandOrders.size} documents`,
);
const afterRetry = vendorStandOrders.get('sub-idem');
assert(
  afterRetry?.boothSize === 3 && afterRetry?.amount === 4350,
  `expected the retry to overwrite boothSize/amount on the same doc (boothSize 3, amount 4350 = R1450 x 3), got boothSize=${afterRetry?.boothSize} amount=${afterRetry?.amount}`,
);
assert(
  afterRetry?.standOrderRef === 'VSO-sub-idem',
  `expected standOrderRef to stay deterministic ("VSO-sub-idem"), got "${afterRetry?.standOrderRef}"`,
);

// --- A post-payment initiate attempt is refused and leaves the paid document untouched ---------
vendorStandOrders.set('sub-idem', { ...vendorStandOrders.get('sub-idem'), status: 'paid', gateway: 'payfast', paidAt: 'fixed-paid-at', gatewayPaymentId: 'pf-123' });
const paidSnapshotBefore = JSON.stringify(vendorStandOrders.get('sub-idem'));
const postPaidInitiate = await callInitiate(token, 1);
assert(
  postPaidInitiate.status === 409,
  `expected an initiate call after payment to be refused 409, got ${postPaidInitiate.status}`,
);
assert(
  JSON.stringify(vendorStandOrders.get('sub-idem')) === paidSnapshotBefore,
  'the paid document was NOT left byte-identical after the refused post-payment initiate call.',
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: two concurrent initiate calls for the same submission produce exactly one document, ' +
    'a legitimate retry overwrites that same document, and a post-payment initiate attempt is ' +
    'refused and leaves the paid document byte-identical.',
);
process.exit(0);
