#!/usr/bin/env node
// Real ozow-itn / payfast-itn routes and the real settlement handler
// (lib/vendor-stand-payment-notification.ts), in-memory fixtures only. Mirrors the ticket path's
// guards exactly (contracts/checks/ozow-sandbox-toggle-f1): a test-mode order settles ONLY on the
// R0.01 notification and REJECTS a real-amount one (before any confirm call); a normal order
// settles ONLY on its real amount and rejects a one-cent one; a pre-existing order doc with no
// expectedGatewayAmount field (or null) falls back to its real amount; a non-finite expectation
// never settles; PayFast is unaffected; receipts and notices keep the real price.
// BASE 24123b74: FAILS (a test-mode order cannot settle on the R0.01 notification).
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-sandbox-amount/check-settlement-amounts.mjs

import {
  initiate, notify, payments, resetAll, seedSubmission, sentAdminNotices, sentConfirmations, setTestMode, store,
} from './_harness.mjs';

const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };

// Creates an order through the REAL initiate route, returns { id, reference, realCents }.
async function makeOrder(id, gateway, flag) {
  setTestMode(flag);
  seedSubmission(id);
  const r = await initiate(id, gateway);
  if (r.status !== 200) throw new Error(`setup: initiate ${r.status} ${JSON.stringify(r.body)}`);
  return { id, reference: r.call.reference, realCents: Math.round(r.order.amount * 100) };
}
const payload = (o, cents, n) => ({ reference: o.reference, rawStatus: 'paid', grossAmountCents: cents, gatewayPaymentId: `gw-${o.id}-${n}` });
const status = (id) => store.vendorStandOrders.get(id)?.status;

async function expectRejected(label, gateway, o, cents) {
  const before = payments.confirmNotificationCalls.length;
  const code = await notify(gateway, payload(o, cents, cents));
  expect(code === 200, `${label}: gateway must still be acknowledged 200, got ${code}.`);
  expect(status(o.id) === 'pending', `${label}: a ${cents}-cent notification must be REJECTED (order stays pending), got ${status(o.id)}.`);
  expect(!store.vendorSubmissions.get(o.id)?.paymentReceived, `${label}: paymentReceived must stay unset.`);
  expect(payments.confirmNotificationCalls.length === before, `${label}: a rejected amount must never spend a gateway confirm round trip.`);
}
async function expectSettled(label, gateway, o, cents, realAmount) {
  const code = await notify(gateway, payload(o, cents, cents));
  expect(code === 200, `${label}: acknowledged 200, got ${code}.`);
  expect(status(o.id) === 'paid', `${label}: a ${cents}-cent notification must SETTLE, got ${status(o.id)}.`);
  expect(store.vendorStandOrders.get(o.id)?.amount === realAmount, `${label}: order.amount must remain the real price ${realAmount}.`);
  const sent = sentConfirmations.at(-1);
  expect(sent?.amount === realAmount, `${label}: receipt must show the REAL price ${realAmount}, got ${sent?.amount}.`);
}

// 1. Ozow test-mode order.
resetAll();
let o = await makeOrder('sub-test-1', 'ozow', true);
await expectRejected('test-mode order / real-amount notification', 'ozow', o, o.realCents);
await expectRejected('test-mode order / 2 cents', 'ozow', o, 2);
await expectSettled('test-mode order / R0.01 notification', 'ozow', o, 1, o.realCents / 100);
expect(sentAdminNotices.length === 1, 'test-mode order: exactly one admin notice on settlement.');

// 2. Ozow normal order (flag off).
resetAll();
o = await makeOrder('sub-real-1', 'ozow', false);
await expectRejected('real-amount order / one-cent notification', 'ozow', o, 1);
await expectSettled('real-amount order / real notification', 'ozow', o, o.realCents, o.realCents / 100);

// 3. Pre-existing doc: no expectedGatewayAmount field at all, and explicit null.
for (const shape of ['absent', 'null']) {
  resetAll();
  o = await makeOrder(`sub-legacy-${shape}`, 'ozow', false);
  const doc = store.vendorStandOrders.get(o.id);
  if (shape === 'absent') delete doc.expectedGatewayAmount; else doc.expectedGatewayAmount = null;
  await expectRejected(`legacy(${shape}) / one-cent notification`, 'ozow', o, 1);
  await expectSettled(`legacy(${shape}) / real notification`, 'ozow', o, o.realCents, o.realCents / 100);
}

// 4. Non-finite expectation never settles on anything.
resetAll();
o = await makeOrder('sub-nan', 'ozow', true);
store.vendorStandOrders.get(o.id).expectedGatewayAmount = Number.NaN;
await expectRejected('NaN expectation / one cent', 'ozow', o, 1);
await expectRejected('NaN expectation / real amount', 'ozow', o, o.realCents);

// 5. PayFast unaffected even with the flag on: real amount only.
resetAll();
o = await makeOrder('sub-pf', 'payfast', true);
await expectRejected('payfast + flag on / one-cent notification', 'payfast', o, 1);
await expectSettled('payfast + flag on / real notification', 'payfast', o, o.realCents, o.realCents / 100);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('PASS: test-mode orders settle only on R0.01, normal and legacy orders only on the real amount, NaN never settles, PayFast unaffected, real price kept on receipts.');
