// ozow-sandbox-toggle F1 — proves resolveExpectedGatewayAmount() computes the POSITIVE proof of
// what gets stored on the order as the gateway's expected amount, mirroring
// resolveOzowInitiateAmount()'s branching exactly so the two functions can never disagree about
// WHEN the override applies — only about WHAT value each returns for the overridden case.
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §3b.
//
// Run as: npx tsx contracts/checks/ozow-sandbox-toggle-f1/check-resolve-expected-gateway-amount.mjs

import { resolveExpectedGatewayAmount } from '../../../lib/ozow-sandbox-test-mode-shared.ts';

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

function check(label, providerId, testModeEnabled, expected) {
  const result = resolveExpectedGatewayAmount(providerId, testModeEnabled);
  if (result !== expected) {
    fail(`${label}: resolveExpectedGatewayAmount(${providerId}, ${testModeEnabled}) = ${result}, expected ${expected}`);
  }
}

// 1. PayFast, flag OFF -> null. Today's behaviour: compare against order.amount.
check('case 1', 'payfast', false, null);

// 2. PayFast, flag ON -> STILL null. PayFast must never be affected by this flag, even if it
// were somehow left on.
check('case 2', 'payfast', true, null);

// 3. Ozow, flag OFF -> null, meaning "compare against order.amount, unchanged".
check('case 3', 'ozow', false, null);

// 4. Ozow, flag ON -> the number 0.01, matching the fixed constant resolveOzowInitiateAmount
// sends the gateway.
check('case 4', 'ozow', true, 0.01);

// 5. An unrecognised providerId, flag ON -> null. Only the literal 'ozow' string ever triggers
// the override, same as resolveOzowInitiateAmount.
check('case 5', 'unknown-provider', true, null);

if (FAIL) {
  console.error('FAIL: resolveExpectedGatewayAmount() does not satisfy the mirrored-branching invariant.');
  process.exit(1);
}
console.log('PASS: resolveExpectedGatewayAmount() overrides Ozow-and-flag-on only, to exactly 0.01; every other combination null.');
