#!/usr/bin/env node
// vendor-gated-registration-flow M3/F26+F30 (A55) -- behavioural proof, via the route-runner
// harness, that POST /api/vendors/stand-payment/initiate is blocked ONLY by
// lib/vendor-stand-pricing.ts's VENDOR_STAND_PRICE_ZAR being null, and that filling in real
// numbers is the ENTIRE follow-up -- no route/page/token code changes between the two runs.
// See contracts/golden/vendor-gated-registration-flow-m3/README.md "The missing-figure
// problem" and "Milestoning the missing figure".
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-gated-registration-flow-m3/check-pricing-blocks-then-unblocks-initiate.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require(
  '../../harness/route-runner/store.mjs',
);
const { initiateCalls, resetPaymentsFixture } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');

const INITIATE = '../../../app/api/vendors/stand-payment/initiate/route.ts';
const PRICING = '../../../lib/vendor-stand-pricing.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const { POST: initiatePost } = await import(INITIATE);
const pricing = await import(PRICING);
const { mintVendorStandPaymentToken } = await import(TOKEN);

const TEST_SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

function resetPricing(values) {
  pricing.VENDOR_STAND_PRICE_ZAR[1] = values[1];
  pricing.VENDOR_STAND_PRICE_ZAR[2] = values[2];
  pricing.VENDOR_STAND_PRICE_ZAR[3] = values[3];
}

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
resetPricing({ 1: null, 2: null, 3: null });
vendorSubmissions.set('sub-pricing', { status: 'approved', businessName: 'Fynbos Pottery', contactEmail: 'jane@example.com' });
const token = mintToken('sub-pricing');

for (const boothSize of [1, 2, 3]) {
  // eslint-disable-next-line no-await-in-loop -- sequential is intentional, each call must be independently observed
  const result = await callInitiate(token, boothSize);
  assert(result.status === 503, `boothSize ${boothSize}: expected 503 with prices null, got ${result.status} (${JSON.stringify(result.body)})`);
  assert(
    /not yet been confirmed/i.test(result.body.error ?? ''),
    `boothSize ${boothSize}: 503 body did not carry the council-blocked message, got "${result.body.error}"`,
  );
}
assert(vendorStandOrders.size === 0, `expected zero vendorStandOrders documents while prices are null, found ${vendorStandOrders.size}`);
assert(initiateCalls.length === 0, `expected zero gateway initiate() calls while prices are null, found ${initiateCalls.length}`);

// The exact same request, unchanged, after Council supplies real numbers -- nothing else
// about the call changes.
resetPricing({ 1: 1500, 2: 2800, 3: 3900 });
const okResult = await callInitiate(token, 2);
assert(okResult.status === 200, `expected 200 once prices are configured, got ${okResult.status} (${JSON.stringify(okResult.body)})`);
assert(
  vendorStandOrders.get('sub-pricing')?.amount === 2800,
  `created order amount should be the configured price (2800), got ${vendorStandOrders.get('sub-pricing')?.amount}`,
);
assert(
  initiateCalls.at(-1)?.amountFormatted === '2800.00',
  `provider.initiate() should have been called with the server-derived amount "2800.00", got "${initiateCalls.at(-1)?.amountFormatted}"`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: initiate refuses 503 for every booth size while VENDOR_STAND_PRICE_ZAR is null (zero ' +
    'writes, zero gateway calls), and the identical request succeeds the moment prices are ' +
    'configured, with the amount taken from the pricing constant, not the request.',
);
process.exit(0);
