#!/usr/bin/env node
// Drives the REAL POST /api/vendors/stand-payment/initiate route (only Firestore, payments and
// notification infrastructure faked) and inspects the exact InitiateInput it hands to the
// payment provider, for BOTH gateways. Proves, with a 60-char SITE_URL: returnUrl, cancelUrl and
// notifyUrl are all <= 150 (Ozow's String(150) cap), carry no signed token, no `paid=` flag, no
// submission id and no PII; the return URL points at the order's own attempt id; and itemName is
// <= 100 chars (PayFast item_name cap) even for an absurdly long business name.
// Mutates nothing real: the Firestore fixture is an in-memory Map.
//
// BASE a42694dc: FAILS (return/cancel URLs are 239-246 chars and embed the token).
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-return-url/check-initiate-route-urls.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vendorSubmissions, vendorStandOrders, resetAllCollections } = require('../../harness/route-runner/store.mjs');
const { resetPaymentsFixture, initiateCalls } = require('../../harness/route-runner/fixture-payments.mjs');
const { setActiveGateway } = require('../../harness/route-runner/fixture-active-gateway.mjs');
const { setShowWindowFixture } = require('../../harness/route-runner/fixture-show-window-lookup.mjs');
const { resetVendorPaymentConfirmationFixture } = require('../../harness/route-runner/fixture-vendor-payment-confirmation.mjs');
const { resetVendorPaymentAdminNoticeFixture } = require('../../harness/route-runner/fixture-vendor-payment-admin-notice.mjs');

const { POST: initiatePost } = await import('../../../app/api/vendors/stand-payment/initiate/route.ts');
const { mintVendorStandPaymentToken } = await import('../../../lib/vendor-stand-payment-token.ts');

const SECRET = 'test-stand-payment-secret-not-real';
process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET = SECRET;
process.env.ADMIN_EMAIL_ALLOWLIST = 'admin-one@example.com';
// 60 chars: longer than every realistic host (prod 18, beta 23, hosted.app fallback 47).
process.env.SITE_URL = `https://${'a'.repeat(41)}.saoc.co.za`;
setShowWindowFixture({ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-04T23:59:59Z') });

const OZOW_URL_CAP = 150;
const PAYFAST_ITEM_NAME_CAP = 100;
const SUBMISSION_ID = 'aB3dEfGh1234567890ZZ'; // real Firestore auto-id length (20)
const BUSINESS_NAME = 'Fynbos Pottery and Orchid Supplies '.repeat(6).trim(); // > 200 chars
const EMAIL = 'jane@fynbospottery.example';
const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };

const token = mintVendorStandPaymentToken({ vendorSubmissionId: SUBMISSION_ID, secret: SECRET, now: new Date() }).token;
let worst = 0;

for (const gateway of ['payfast', 'ozow']) {
  resetAllCollections();
  resetPaymentsFixture();
  resetVendorPaymentConfirmationFixture();
  resetVendorPaymentAdminNoticeFixture();
  setActiveGateway(gateway);
  vendorSubmissions.set(SUBMISSION_ID, { status: 'approved', businessName: BUSINESS_NAME, contactPersonName: 'Jane Vendor', contactEmail: EMAIL });

  const res = await initiatePost({ json: async () => ({ token, boothSize: 1 }) });
  if (res.status !== 200) {
    failures.push(`[${gateway}] test setup: initiate returned ${res.status}: ${JSON.stringify(await res.json())}`);
    continue;
  }
  const call = initiateCalls.at(-1);
  const order = vendorStandOrders.get(SUBMISSION_ID);
  for (const key of ['returnUrl', 'cancelUrl', 'notifyUrl']) {
    const url = call[key];
    worst = Math.max(worst, url.length);
    expect(url.length <= OZOW_URL_CAP, `[${gateway}] ${key} is ${url.length} chars (> ${OZOW_URL_CAP}): ${url.slice(0, 80)}...`);
    expect(!url.includes(token) && !url.includes(encodeURIComponent(token)) && !url.includes(token.slice(0, 20)), `[${gateway}] ${key} must not contain any part of the signed payment token.`);
    expect(!/token=|paid=/i.test(url), `[${gateway}] ${key} must not carry token= or paid= query flags.`);
    expect(!url.includes(SUBMISSION_ID) && !url.includes('Fynbos') && !url.includes('example') && !url.includes('@'), `[${gateway}] ${key} must carry no submission id and no PII.`);
  }
  expect(call.returnUrl === call.cancelUrl, `[${gateway}] success, cancel and error all land on ONE server-derived status URL (returnUrl must equal cancelUrl).`);
  expect(new URL(call.returnUrl).searchParams.get('a') === order?.attemptId && /^[0-9a-f]{16}$/.test(order?.attemptId ?? ''), `[${gateway}] return URL must carry only the order's own 16-hex attemptId (a=${new URL(call.returnUrl).searchParams.get('a')}, order.attemptId=${order?.attemptId}).`);
  expect(new URL(call.returnUrl).pathname === '/vsp', `[${gateway}] return URL path must be /vsp.`);
  expect(call.notifyUrl.endsWith(gateway === 'ozow' ? '/api/vendors/stand-payment/ozow-itn' : '/api/vendors/stand-payment/payfast-itn'), `[${gateway}] notifyUrl path must be unchanged.`);
  expect(call.itemName.length <= PAYFAST_ITEM_NAME_CAP, `[${gateway}] itemName is ${call.itemName.length} chars (> PayFast item_name cap ${PAYFAST_ITEM_NAME_CAP}).`);
  expect(call.itemName.startsWith('SAOC National Show — Vendor Stand'), `[${gateway}] itemName must keep its existing prefix.`);
  expect(call.reference.length <= 45, `[${gateway}] reference must keep its existing <= 45 length (got ${call.reference.length}).`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log(`PASS: real initiate route, both gateways, 60-char SITE_URL: return/cancel/notify URLs max ${worst} <= ${OZOW_URL_CAP}, no token/id/PII, itemName <= ${PAYFAST_ITEM_NAME_CAP}.`);
