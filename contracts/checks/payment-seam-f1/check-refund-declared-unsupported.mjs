#!/usr/bin/env node
// A7 — refund() IS A DECLARED SIGNATURE, NOT AN INVENTED INTEGRATION.
//
// There is NO refund code anywhere in this repository today — grepped across app/ and lib/ on
// 2026-08-19: the only hits are marketing copy on /refunds. F1 is a pure move, and a pure move
// cannot move something that does not exist. So the PayFast adapter must declare refund() and
// return an explicit, honest refusal. What it must NOT do is call a PayFast refund API that
// nothing in this codebase has ever exercised: that would be unverifiable new behaviour smuggled
// in under a refactor, reachable by no route, provable by no live test.
//
// WHAT MAKES THIS FAIL: the module not existing (pre-move); refund() throwing instead of
// returning; refund() returning ok:true (a silent lie that a caller would treat as a completed
// refund); refund() making ANY network call (case 2 hard-fails the injected fetch).
//
// Run as: npx tsx contracts/checks/payment-seam-f1/check-refund-declared-unsupported.mjs

import { createPayfastProvider } from '../../../lib/payments/payfast.ts';
import { makeReporter } from './_golden.mjs';

const r = makeReporter('A7 refund declared-unsupported');

let fetchCalls = 0;
const provider = createPayfastProvider({
  env: {
    PAYFAST_SANDBOX_MERCHANT_ID: '10000100',
    PAYFAST_SANDBOX_MERCHANT_KEY: 'test-merchant-key-not-real',
    PAYFAST_SANDBOX_PASSPHRASE: 'test-passphrase-not-real',
  },
  fetch: async () => {
    fetchCalls += 1;
    throw new Error('refund() must not make a network call in F1');
  },
});

const input = { reference: 'SAOC-2027-GOLDEN0001', gatewayPaymentId: '9999001', amountFormatted: '250.00' };

// Case 1 — returns the explicit refusal, by value, without throwing.
let result;
try {
  result = await provider.refund(input);
} catch (error) {
  r.ok('case 1: refund refuses by return value, never by throwing', false, String(error));
  result = null;
}
r.eq('case 1: refusal shape', result, { ok: false, reason: 'not-supported' });

// Case 2 — no network call was attempted. This is what separates "declared and honest" from
// "quietly integrated against an API nothing has tested".
r.eq('case 2: zero fetch calls', fetchCalls, 0);

// Case 3 — NON-VACUITY. refund() is genuinely present and callable on the interface (not merely
// absent, which would also produce "no fetch calls").
r.eq('case 3: refund is a function on the provider', typeof provider.refund, 'function');
r.ok('case 3: and it returns a promise', result !== null);

// Case 4 — the refusal is not a fully-succeeded result wearing a false flag: no refund id leaks.
r.ok('case 4: no providerRefundId on a refusal', result !== null && !('providerRefundId' in result), JSON.stringify(result));

r.done();
