// ozow-sandbox-toggle F1 — proves lib/tickets-notification.ts's exported
// notificationAmountMatches(lookup, grossAmountCents) resolves the Codex-found gap: a test-mode
// Ozow order's notification now reaches 'paid', while every existing rejection/acceptance case
// (PayFast, Ozow with the flag off, any order predating this field) is unchanged. Tested offline
// by calling the function directly with a plain constructed object — no live Firestore, no
// network, no full eleven-step handler.
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §3b.
//
// Run as: npx tsx contracts/checks/ozow-sandbox-toggle-f1/check-notification-amount-match-test-mode.mjs

import { notificationAmountMatches } from '../../../lib/tickets-notification.ts';

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

function check(label, lookup, grossAmountCents, expected) {
  const result = notificationAmountMatches(lookup, grossAmountCents);
  if (result !== expected) {
    fail(`${label}: notificationAmountMatches(${JSON.stringify(lookup)}, ${grossAmountCents}) = ${result}, expected ${expected}`);
  }
}

// 1. expectedGatewayAmount=null, amount=250.00, notification reports 25000 cents (R250.00)
// -> PASSES. Today's normal case, unchanged.
check('case 1', { amount: 250.0, expectedGatewayAmount: null }, 25000, true);

// 2. expectedGatewayAmount=0.01, amount=250.00 (a real Ozow test-mode order — amount is NEVER
// touched, per README §3), notification reports 1 cent (Ozow actually charged R0.01)
// -> PASSES. This is the exact scenario Codex found broken, and it must now succeed.
check('case 2', { amount: 250.0, expectedGatewayAmount: 0.01 }, 1, true);

// 3. expectedGatewayAmount=null, amount=250.00, notification reports 1 cent (a genuine mismatch,
// NOT test mode) -> still FAILS. Proves the fraud-prevention guard is not weakened for the
// normal case.
check('case 3', { amount: 250.0, expectedGatewayAmount: null }, 1, false);

// 4. expectedGatewayAmount=undefined (PayFast orders never set this field), amount=250.00,
// notification reports 1 cent -> still FAILS. Proves PayFast's path is completely unaffected.
check('case 4', { amount: 250.0 }, 1, false);

// 5. grossAmountCents is null (the gateway adapter could not parse an amount at all) -> FAILS,
// regardless of expectedGatewayAmount. Carried forward from the pre-fix null-guard.
check('case 5', { amount: 250.0, expectedGatewayAmount: 0.01 }, null, false);

if (FAIL) {
  console.error('FAIL: notificationAmountMatches() does not resolve the test-mode amount-match gap correctly.');
  process.exit(1);
}
console.log('PASS: notificationAmountMatches() accepts test-mode Ozow notifications and rejects every mismatch exactly as before.');
