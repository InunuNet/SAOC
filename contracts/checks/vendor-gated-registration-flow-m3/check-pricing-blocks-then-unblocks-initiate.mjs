#!/usr/bin/env node
// vendor-gated-registration-flow M3/F26+F30 (A55) -- behavioural proof, via the route-runner
// harness, that POST /api/vendors/stand-payment/initiate is blocked ONLY by the ability to
// derive a real early-bird cutoff, and that publishing an active show is the ENTIRE follow-up
// -- no route/page/token code changes between the two runs.
//
// REVISED 2026-09-01 by vendor-stand-early-bird-pricing (M1/F1): Brad confirmed all six
// prices (R1450/stand standard, 20% early-bird) and the 90-day cutoff rule the same day M3
// shipped this check against council-blocked null prices. The flat, settable
// VENDOR_STAND_PRICE_ZAR this check originally mutated no longer exists -- prices can never
// be null again (they're derived from one confirmed rate). The refusal mechanism this check
// proves migrated onto the one input that CAN still be genuinely missing: no active show
// published in Sanity means no early-bird cutoff can be derived, which is the modern
// equivalent of "Council hasn't given us a number yet". See
// contracts/golden/vendor-stand-early-bird-pricing/README.md "Refuse-on-missing-cutoff — where
// M3's refusal discipline now lives" for the full decision record; the original "missing-figure
// problem" reasoning in contracts/golden/vendor-gated-registration-flow-m3/README.md still
// explains WHY a milestone-able refusal matters here, just not WHAT triggers it any more.
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
setShowWindowFixture(null); // no active show published -- the modern "missing figure" case
vendorSubmissions.set('sub-pricing', { status: 'approved', businessName: 'Fynbos Pottery', contactEmail: 'jane@example.com' });
const token = mintToken('sub-pricing');

for (const boothSize of [1, 2, 3]) {
  // eslint-disable-next-line no-await-in-loop -- sequential is intentional, each call must be independently observed
  const result = await callInitiate(token, boothSize);
  assert(result.status === 503, `boothSize ${boothSize}: expected 503 with no active show configured, got ${result.status} (${JSON.stringify(result.body)})`);
  assert(
    /not yet been confirmed/i.test(result.body.error ?? ''),
    `boothSize ${boothSize}: 503 body did not carry the council-blocked-shaped message, got "${result.body.error}"`,
  );
}
assert(vendorStandOrders.size === 0, `expected zero vendorStandOrders documents while no show is configured, found ${vendorStandOrders.size}`);
assert(initiateCalls.length === 0, `expected zero gateway initiate() calls while no show is configured, found ${initiateCalls.length}`);

// The exact same request, unchanged, once a real show (and therefore a real cutoff) exists.
// Show opens 2026-10-01 -> cutoff derives to ~2026-07-03 (SAST) -- safely in the past relative
// to the real clock, so boothSize 2 resolves to the confirmed REGULAR-tier price (R2900).
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });
const okResult = await callInitiate(token, 2);
assert(okResult.status === 200, `expected 200 once a show is configured, got ${okResult.status} (${JSON.stringify(okResult.body)})`);
assert(
  vendorStandOrders.get('sub-pricing')?.amount === 2900,
  `created order amount should be the confirmed price (R1450 x 2 = 2900), got ${vendorStandOrders.get('sub-pricing')?.amount}`,
);
assert(
  initiateCalls.at(-1)?.amountFormatted === '2900.00',
  `provider.initiate() should have been called with the server-derived amount "2900.00", got "${initiateCalls.at(-1)?.amountFormatted}"`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: initiate refuses 503 for every booth size while no active show is configured (zero ' +
    'writes, zero gateway calls), and the identical request succeeds the moment a show is ' +
    'published, with the amount derived from the confirmed per-stand rate, not the request.',
);
process.exit(0);
