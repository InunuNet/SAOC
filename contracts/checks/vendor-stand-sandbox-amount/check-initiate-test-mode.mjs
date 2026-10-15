#!/usr/bin/env node
// Real POST /api/vendors/stand-payment/initiate (in-memory fixtures only) against the Ozow
// Sandbox Test Mode toggle. Proves: ozow + flag on sends Amount 0.01 and stores
// expectedGatewayAmount 0.01 while order.amount and the displayed response amount stay the real
// price; flag off / flag doc missing / PayFast with flag on send the real amount and store
// expectedGatewayAmount null (own property present, never undefined); the amount sent always
// equals what the stored expectation implies; a re-initiate after the flag flips re-derives both.
// BASE 24123b74: FAILS (the route ignores the toggle and sends the real amount).
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-sandbox-amount/check-initiate-test-mode.mjs

import { initiate, resetAll, seedSubmission, setTestMode } from './_harness.mjs';

const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };
const ID = 'aB3dEfGh1234567890ZZ';

async function scenario(label, { gateway, flag, expectTest }) {
  resetAll();
  setTestMode(flag);
  seedSubmission(ID);
  const r = await initiate(ID, gateway);
  if (r.status !== 200) { failures.push(`${label}: initiate returned ${r.status} ${JSON.stringify(r.body)}`); return null; }
  const real = r.order.amount.toFixed(2);
  expect(Number.isFinite(r.order.amount) && r.order.amount > 0.01, `${label}: order.amount must stay the real server-derived price (got ${r.order.amount}).`);
  expect(r.body.amount === real, `${label}: response amount shown to the vendor must be the real price ${real}, got ${r.body.amount}.`);
  expect(Object.prototype.hasOwnProperty.call(r.order, 'expectedGatewayAmount') && r.order.expectedGatewayAmount !== undefined, `${label}: order must carry an expectedGatewayAmount own property (null or a number, never undefined).`);
  if (expectTest) {
    expect(r.order.expectedGatewayAmount === 0.01, `${label}: expectedGatewayAmount must be 0.01, got ${r.order.expectedGatewayAmount}.`);
    expect(r.call.amountFormatted === '0.01', `${label}: amount sent to the gateway must be 0.01, got ${r.call.amountFormatted}.`);
  } else {
    expect(r.order.expectedGatewayAmount === null, `${label}: expectedGatewayAmount must be null, got ${r.order.expectedGatewayAmount}.`);
    expect(r.call.amountFormatted === real, `${label}: amount sent to the gateway must be the real ${real}, got ${r.call.amountFormatted}.`);
  }
  return r;
}

await scenario('ozow + flag on', { gateway: 'ozow', flag: true, expectTest: true });
await scenario('ozow + flag off', { gateway: 'ozow', flag: false, expectTest: false });
await scenario('ozow + flag doc missing (fail closed)', { gateway: 'ozow', flag: null, expectTest: false });
await scenario('payfast + flag on (PayFast unaffected)', { gateway: 'payfast', flag: true, expectTest: false });
await scenario('payfast + flag off', { gateway: 'payfast', flag: false, expectTest: false });

// Re-initiate after the flag flips: the new attempt re-derives the expectation and overwrites.
resetAll(); seedSubmission(ID);
setTestMode(true);
const first = await initiate(ID, 'ozow');
setTestMode(false);
const second = await initiate(ID, 'ozow');
expect(first.order?.expectedGatewayAmount === 0.01, 're-initiate setup: first attempt must be test mode.');
expect(second.order?.expectedGatewayAmount === null && second.call.amountFormatted === second.order.amount.toFixed(2), 're-initiate after flag off must store null and send the real amount (set, not merge).');

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('PASS: initiate honours the Ozow sandbox toggle (ozow only), stores expectedGatewayAmount, keeps real amount for display and records, fails closed, PayFast unaffected.');
