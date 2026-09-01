#!/usr/bin/env node
// vendor-gated-registration-flow M3/F27+F30 (A62) -- behavioural proof, via the route-runner
// harness, that POST /api/vendors/stand-payment/initiate re-reads the linked submission's
// CURRENT state on every call, rather than trusting a state snapshot implied by a successful
// token verification. See contracts/golden/vendor-gated-registration-flow-m3/README.md "Token
// mechanism".
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-gated-registration-flow-m3/check-token-state-gated-not-snapshot.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require(
  '../../harness/route-runner/store.mjs',
);
const { resetPaymentsFixture } = require('../../harness/route-runner/fixture-payments.mjs');
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

pricing.VENDOR_STAND_PRICE_ZAR[1] = 1500;
pricing.VENDOR_STAND_PRICE_ZAR[2] = 2800;
pricing.VENDOR_STAND_PRICE_ZAR[3] = 3900;
setActiveGateway('payfast');

function mintToken(vendorSubmissionId) {
  return mintVendorStandPaymentToken({ vendorSubmissionId, secret: TEST_SECRET, now: new Date() }).token;
}

async function callInitiate(token, boothSize) {
  const res = await initiatePost({ json: async () => ({ token, boothSize }) });
  return { status: res.status, body: await res.json() };
}

// --- A: token minted while approved, then submission status changes before use ----------------
resetAllCollections();
resetPaymentsFixture();
vendorSubmissions.set('sub-was-approved', { status: 'approved', businessName: 'Fynbos Pottery', contactEmail: 'jane@example.com' });
const tokenA = mintToken('sub-was-approved');
// The token is cryptographically valid at this point -- state changes AFTER the mint, before use.
vendorSubmissions.set('sub-was-approved', { ...vendorSubmissions.get('sub-was-approved'), status: 'rejected' });
const afterRejected = await callInitiate(tokenA, 1);
assert(
  afterRejected.status === 403,
  `expected a cryptographically-valid token for a no-longer-approved submission to be refused 403, got ${afterRejected.status}`,
);
assert(
  vendorStandOrders.size === 0,
  `expected no vendorStandOrders document to be created for a no-longer-approved submission, found ${vendorStandOrders.size}`,
);

// --- B: token valid, submission still approved, but its stand order is already paid -----------
resetAllCollections();
resetPaymentsFixture();
vendorSubmissions.set('sub-already-paid', { status: 'approved', businessName: 'Fynbos Pottery', contactEmail: 'jane@example.com' });
const tokenB = mintToken('sub-already-paid');
vendorStandOrders.set('sub-already-paid', { status: 'paid' });
const afterPaid = await callInitiate(tokenB, 1);
assert(
  afterPaid.status === 409,
  `expected a valid token for an already-paid stand to be refused 409 (distinct from the generic token refusal), got ${afterPaid.status}`,
);

// --- C: the two refusal classes must be diagnosably distinct -----------------------------------
assert(
  typeof afterRejected.body?.error === 'string' && typeof afterPaid.body?.error === 'string',
  'expected both refusals to carry an error message.',
);
assert(
  afterRejected.body?.error !== afterPaid.body?.error,
  `the "no longer approved" refusal and the "already paid" refusal used the SAME message ("${afterRejected.body?.error}") -- these are two genuinely different failure classes and must be diagnosably distinct, per the golden README.`,
);

// --- D: sanity control -- the SAME token, same submission, still approved and unpaid, succeeds -
resetAllCollections();
resetPaymentsFixture();
vendorSubmissions.set('sub-control', { status: 'approved', businessName: 'Fynbos Pottery', contactEmail: 'jane@example.com' });
const tokenD = mintToken('sub-control');
const control = await callInitiate(tokenD, 1);
assert(control.status === 200, `sanity control: expected a valid token against a still-approved, unpaid submission to succeed, got ${control.status}`);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: initiate re-reads the submission\'s live status and the stand order\'s live paid ' +
    'state on every call -- a cryptographically valid token minted while approved is refused ' +
    'once that state changes, with the two refusal classes ("no longer approved" vs "already ' +
    'paid") carrying genuinely distinct messages, never trusting a mint-time snapshot.',
);
process.exit(0);
