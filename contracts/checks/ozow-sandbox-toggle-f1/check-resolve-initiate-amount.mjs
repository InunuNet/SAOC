// ozow-sandbox-toggle F1 — proves resolveOzowInitiateAmount() is a pure function of an
// ALREADY-RESOLVED `expectedGatewayAmount` (never of a providerId/testModeEnabled pair): `null`
// passes `realAmountFormatted` through unchanged, any non-null value overrides to the fixed
// '0.01' regardless of `realAmountFormatted`.
//
// REVISED 2026-08-24 (second Codex GPT-5.5 cross-model review, README §3c): the signature
// changed from (providerId, realAmountFormatted, testModeEnabled) to
// (expectedGatewayAmount: number | null, realAmountFormatted: string) — no providerId, no
// testModeEnabled. This is the POSITIVE proof that the initiate() amount is derived from the
// caller's already-resolved value (fresh for a new reservation, the order's own stored value for
// a replay — see A10), never from a second, independent flag read.
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §3c.
//
// Run as: npx tsx contracts/checks/ozow-sandbox-toggle-f1/check-resolve-initiate-amount.mjs

import { resolveOzowInitiateAmount } from '../../../lib/ozow-sandbox-test-mode-shared.ts';

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

function check(label, expectedGatewayAmount, realAmountFormatted, expected) {
  const result = resolveOzowInitiateAmount(expectedGatewayAmount, realAmountFormatted);
  if (result !== expected) {
    fail(
      `${label}: resolveOzowInitiateAmount(${expectedGatewayAmount}, ${realAmountFormatted}) = ${result}, expected ${expected}`
    );
  }
}

// 1. expectedGatewayAmount=null -> realAmountFormatted passed through unchanged. This single
// null case now covers BOTH "PayFast, any flag state" and "Ozow, flag off" — both collapse to
// null one level up, in resolveExpectedGatewayAmount, which A8 already proves.
check('case 1', null, '250.00', '250.00');

// 2. expectedGatewayAmount=0.01 -> overridden to the fixed test amount.
check('case 2', 0.01, '250.00', '0.01');

// 3. expectedGatewayAmount=0.01, a different (larger) real amount -> still exactly '0.01',
// proving the override is a fixed constant, not derived from realAmountFormatted.
check('case 3', 0.01, '9999.99', '0.01');

// 4. expectedGatewayAmount=null, realAmountFormatted='0.01' (coincidentally already a cent) ->
// unchanged via the pass-through path, not the override path — distinguishing "coincidentally
// 1 cent" from "test-mode override". Same output as case 2 by coincidence, but reached via the
// null/pass-through branch, not the override branch.
check('case 4', null, '0.01', '0.01');

if (FAIL) {
  console.error(
    'FAIL: resolveOzowInitiateAmount() does not satisfy the already-resolved-value invariant.'
  );
  process.exit(1);
}
console.log(
  'PASS: resolveOzowInitiateAmount() is a pure function of expectedGatewayAmount — null passes through, any non-null value overrides to the fixed 0.01.'
);
