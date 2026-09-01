#!/usr/bin/env node
// vendor-stand-early-bird-pricing F1 (A4) -- behavioural (route-runner harness) + pure-function
// proof. Now that all six prices and the 90-day cutoff RULE are confirmed, the only remaining
// way this feature is "genuinely unpriceable" is operational: no active show is published in
// Sanity, so the early-bird cutoff cannot be derived at all. This must still refuse cleanly,
// BEFORE any Firestore write or gateway call -- the exact posture M3's A55 established for the
// old "prices are null" case must survive onto this new failure mode, not become unreachable
// now that the prices themselves are hardcoded confirmed constants. See
// contracts/golden/vendor-stand-early-bird-pricing/README.md "Refuse-on-null migrates to
// refuse-on-missing-cutoff".
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-early-bird-pricing/check-refuses-when-cutoff-unavailable.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require(
  '../../harness/route-runner/store.mjs',
);
const { resetPaymentsFixture, initiateCalls } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');

const INITIATE = '../../../app/api/vendors/stand-payment/initiate/route.ts';
const PRICING = '../../../lib/vendor-stand-pricing.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

// --- Pure-function proof: resolveVendorStandPrice itself refuses when handed a null cutoff,
// independent of any route/Firestore plumbing. This is the actual refusal mechanism the
// route below relies on. Guarded by a static check that the NEW three-argument, confirmed-
// pricing implementation actually exists -- without this guard, the old (still-null) M3
// pricing would trivially satisfy the same assertion below for the wrong reason (booth 1
// still unpriced, not "cutoff unavailable"), producing a false-negative RED. ---
import { readFileSync } from 'node:fs';
const pricingSource = readFileSync(new URL('../../../lib/vendor-stand-pricing.ts', import.meta.url), 'utf8');
assert(
  /145000/.test(pricingSource) &&
    /resolveVendorStandPrice\s*\(\s*\w+\s*:\s*unknown\s*,\s*\w+\s*:\s*Date\s*,\s*\w+\s*:/.test(pricingSource),
  'lib/vendor-stand-pricing.ts does not yet declare resolveVendorStandPrice(boothSize, now, cutoffIso) with the confirmed per-stand rate -- the refusal proof below cannot be trusted until the new signature exists (against the OLD flat pricing, the same assertion would pass for the wrong reason: booth 1 simply still being unpriced, not "cutoff unavailable")',
);

let pricing;
try {
  pricing = await import(PRICING);
} catch (error) {
  failures.push(`failed to import lib/vendor-stand-pricing.ts: ${error.message}`);
}
if (pricing && typeof pricing.resolveVendorStandPrice === 'function') {
  try {
    const result = pricing.resolveVendorStandPrice(1, new Date(), null);
    assert(
      result.ok === false && result.reason === 'not-configured',
      `resolveVendorStandPrice(1, now, null) -- a null cutoff (no active show) must refuse {ok:false, reason:'not-configured'}, got ${JSON.stringify(result)}`,
    );
  } catch (error) {
    failures.push(`resolveVendorStandPrice(boothSize, now, cutoffIso) threw: ${error.message}`);
  }
} else if (pricing) {
  failures.push('lib/vendor-stand-pricing.ts does not export resolveVendorStandPrice as a function');
}

// --- Behavioural: the real route, with NO active show configured (show-window fixture left
// at its default null), refuses BEFORE any Firestore write or gateway call -- same shape as
// A55's original "prices are null" proof. ---
let initiatePost;
let mintVendorStandPaymentToken;
try {
  ({ POST: initiatePost } = await import(INITIATE));
  ({ mintVendorStandPaymentToken } = await import(TOKEN));
} catch (error) {
  failures.push(`failed to import route/token modules: ${error.message}`);
}

if (initiatePost && mintVendorStandPaymentToken) {
  const TEST_SECRET = 'test-stand-payment-secret-not-real';
  process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = TEST_SECRET;

  try {
    resetAllCollections();
    resetPaymentsFixture();
    setActiveGateway('payfast');
    setShowWindowFixture(null); // no active show published -- the genuinely-missing case

    vendorSubmissions.set('sub-no-show', {
      status: 'approved',
      businessName: 'Fynbos Pottery',
      contactEmail: 'jane@example.com',
    });
    const token = mintVendorStandPaymentToken({
      vendorSubmissionId: 'sub-no-show',
      secret: TEST_SECRET,
      now: new Date(),
    }).token;

    const res = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
    const body = await res.json();

    assert(
      res.status === 503,
      `with no active show configured, expected 503, got ${res.status} (${JSON.stringify(body)})`,
    );
    assert(
      !vendorStandOrders.has('sub-no-show'),
      'no vendorStandOrders document should be created when the cutoff cannot be derived',
    );
    assert(
      initiateCalls.length === 0,
      'no gateway initiate() call should happen when the cutoff cannot be derived',
    );
  } catch (error) {
    failures.push(`behavioural scenario threw: ${error.stack ?? error.message}`);
  }
}

if (failures.length > 0) {
  console.log('FAIL — check-refuses-when-cutoff-unavailable');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('PASS — check-refuses-when-cutoff-unavailable');
  process.exit(0);
}
