#!/usr/bin/env node
// A6 — refund() IS A DECLARED SIGNATURE, NOT AN INVENTED INTEGRATION. Ozow's refund API is real
// and documented to exist (spec §0), unlike PayFast's — but its field-level request/response
// shape is out of scope per the dispatch brief ("float/fee mechanics are still open vendor
// questions... refund() stubbed as not-supported, out of scope for this feature"). Same
// discipline as contract-payment-seam-f1.yaml A7: an unverified integration must not be smuggled
// in under this feature.
//
// WHAT MAKES THIS FAIL: the module not existing; refund() throwing instead of returning; refund()
// returning ok:true (a silent lie a caller would treat as a completed refund); refund() making
// ANY network call (the injected fetch throws if touched).
//
// Run as: npx tsx contracts/checks/ozow-m1-f1/check-refund-declared-unsupported.mjs

import { createOzowProvider } from '../../../lib/payments/ozow.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A6 refund declared-unsupported');
const creds = golden.credentials;

let fetchCalls = 0;
const provider = createOzowProvider({
  env: { OZOW_SANDBOX_SITE_CODE: creds.siteCode, OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey, OZOW_SANDBOX_API_KEY: 'test-api-key-not-real' },
  fetch: async () => {
    fetchCalls += 1;
    throw new Error('refund() must not make a network call in this feature');
  },
});

const input = { reference: golden.outbound.inputs.reference, gatewayPaymentId: 'OZW-TXN-GOLDEN-0001', amountFormatted: '250.00' };

// Case 1 — returns the explicit refusal, by value, without throwing.
let result;
try {
  result = await provider.refund(input);
} catch (error) {
  r.ok('case 1: refund refuses by return value, never by throwing', false, String(error));
  result = null;
}
r.eq('case 1: refusal shape', result, { ok: false, reason: 'not-supported' });

// Case 2 — no network call was attempted.
r.eq('case 2: zero fetch calls', fetchCalls, 0);

// Case 3 — NON-VACUITY. refund() is genuinely present and callable.
r.eq('case 3: refund is a function on the provider', typeof provider.refund, 'function');
r.ok('case 3: and it returns a promise', result !== null);

// Case 4 — no refund id leaks on a refusal.
r.ok('case 4: no providerRefundId on a refusal', result !== null && !('providerRefundId' in result), JSON.stringify(result));

r.done();
