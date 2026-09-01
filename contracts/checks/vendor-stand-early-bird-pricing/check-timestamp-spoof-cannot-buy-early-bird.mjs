#!/usr/bin/env node
// vendor-stand-early-bird-pricing F1 (A3) -- behavioural, via the route-runner harness, PLUS a
// static class assertion. A forged client-supplied timestamp field in the POST body of
// /api/vendors/stand-payment/initiate must never influence which price tier applies -- the
// route must derive `now` itself (it already does, for token-expiry verification) and reuse
// that SAME value for resolveVendorStandPrice, never a body-derived one. Money is real now
// (R1450/R1160 confirmed), so this is the property that protects it. See
// contracts/golden/vendor-stand-early-bird-pricing/README.md "The tier decision is
// server-side and unspoofable".
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-early-bird-pricing/check-timestamp-spoof-cannot-buy-early-bird.mjs

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require(
  '../../harness/route-runner/store.mjs',
);
const { resetPaymentsFixture } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');

const INITIATE = '../../../app/api/vendors/stand-payment/initiate/route.ts';
const TOKEN = '../../../lib/vendor-stand-payment-token.ts';

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

// --- Static class assertion: the route's request-body allow-list stays {token, boothSize},
// and no body-derived identifier is ever threaded into resolveVendorStandPrice's `now`
// argument. Extends (does not replace) M3's own A59 class assertion for this same route. ---
const routeSource = readFileSync(
  new URL('../../../app/api/vendors/stand-payment/initiate/route.ts', import.meta.url),
  'utf8',
);
const forbiddenBodyTimeKeys = ['now', 'timestamp', 'clientNow', 'purchasedAt', 'clientTime', 'date'];
for (const key of forbiddenBodyTimeKeys) {
  assert(
    !new RegExp(`body\\.${key}\\b`).test(routeSource),
    `initiate route reads body.${key} -- the request body allow-list must stay {token, boothSize}, never a client-supplied time field`,
  );
}
assert(
  /resolveVendorStandPrice\(\s*boothSize\s*,\s*now\s*,/.test(routeSource),
  'initiate route does not call resolveVendorStandPrice(boothSize, now, ...) with the server-derived `now` it already computes for token verification -- either the call is missing, or a different (possibly body-derived) identifier is passed',
);

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

  function mintToken(vendorSubmissionId) {
    return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
  }

  function seedSubmission(id) {
    vendorSubmissions.set(id, {
      status: 'approved',
      businessName: 'Fynbos Pottery',
      contactEmail: 'jane@example.com',
    });
  }

  async function callInitiate(token, boothSize, extra = {}) {
    const res = await initiatePost({ json: async () => ({ token, boothSize, ...extra }) });
    return { status: res.status, body: await res.json() };
  }

  try {
    resetAllCollections();
    resetPaymentsFixture();
    setActiveGateway('payfast');

    // Show opens 2027-09-16 -> real cutoff derives to 2027-06-18 (SAST). Well in the past
    // relative to the REAL clock this test runs under (2026-09-01 or later), so the actual
    // server time unambiguously lands in the 'regular' tier. Any result landing in
    // 'earlyBird' can only be explained by a forged body field winning.
    setShowWindowFixture({ startDate: new Date('2027-09-16T00:00:00Z'), endDate: new Date('2027-09-19T23:59:59Z') });

    seedSubmission('sub-honest');
    const honestToken = mintToken('sub-honest');
    const honestResult = await callInitiate(honestToken, 1);
    assert(
      honestResult.status === 200 &&
        vendorStandOrders.get('sub-honest')?.amount === 1450 &&
        vendorStandOrders.get('sub-honest')?.tier === 'regular',
      `baseline (no forged field): expected amount 1450 / tier 'regular', got status ${honestResult.status}, order ${JSON.stringify(vendorStandOrders.get('sub-honest'))}`,
    );

    for (const [spoofKey, spoofValue] of [
      ['now', '2019-01-01T00:00:00Z'],
      ['timestamp', '2019-01-01T00:00:00Z'],
      ['clientNow', '2019-01-01T00:00:00Z'],
      ['purchasedAt', '2019-01-01T00:00:00Z'],
    ]) {
      const submissionId = `sub-spoof-${spoofKey}`;
      seedSubmission(submissionId);
      const spoofToken = mintToken(submissionId);
      const spoofResult = await callInitiate(spoofToken, 1, { [spoofKey]: spoofValue });
      const order = vendorStandOrders.get(submissionId);
      assert(
        spoofResult.status === 200 && order?.amount === 1450 && order?.tier === 'regular',
        `forged body.${spoofKey}='${spoofValue}' (a date well before the real early-bird cutoff) must be ignored -- expected amount 1450 / tier 'regular' exactly as the honest request got, got status ${spoofResult.status}, order ${JSON.stringify(order)}`,
      );
    }
  } catch (error) {
    failures.push(`behavioural scenario threw: ${error.stack ?? error.message}`);
  }
}

if (failures.length > 0) {
  console.log('FAIL — check-timestamp-spoof-cannot-buy-early-bird');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('PASS — check-timestamp-spoof-cannot-buy-early-bird');
  process.exit(0);
}
