#!/usr/bin/env node
// A6 — SERVER-CONFIRM ROUND-TRIP. PayFast's documented anti-spoofing mechanism: POST the received
// data back to /eng/query/validate and require the response body to be exactly 'VALID'. With the
// source-IP check log-only since 2026-08-18, this and the signature check ARE the security
// boundary, so its wire shape is pinned rather than described.
//
// The body must be built with the INBOUND builder (posted order, no trim, no blank-skip) — PayFast
// specifies one inbound param string reused for both the digest and this postback. Case 2 pins the
// exact bytes, so switching to the outbound builder (the pre-F10 bug) fails here.
//
// WHAT MAKES THIS FAIL: the module not existing (pre-move); the URL changing; the body built with
// the outbound builder or re-serialised from a re-parsed body; 'VALID' matched by substring or
// case-insensitively; a non-VALID response or a network error being treated as confirmed; a thrown
// fetch propagating instead of being converted to a refusal.
//
// Offline: fetch is injected, no network call is made.
//
// Run as: npx tsx contracts/checks/payment-seam-f1/check-server-confirm.mjs

import { createPayfastProvider } from '../../../lib/payments/payfast.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A6 confirmNotification server round-trip');
const g = golden.inbound;

const notification = {
  reference: g.fields.m_payment_id,
  rawStatus: g.fields.payment_status,
  grossAmount: g.fields.amount_gross,
  gatewayPaymentId: g.fields.pf_payment_id,
  sourceIp: null,
  sourceIpTrusted: null,
  raw: g.fields,
};

let calls = [];
function provider(responder) {
  calls = [];
  return createPayfastProvider({
    env: {
      PAYFAST_SANDBOX_MERCHANT_ID: '10000100',
      PAYFAST_SANDBOX_MERCHANT_KEY: 'test-merchant-key-not-real',
      PAYFAST_SANDBOX_PASSPHRASE: g.passphrase,
    },
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return responder();
    },
  });
}
const respond = (text, status = 200) => () => ({ ok: status < 400, status, text: async () => text });

// Case 1 — POSITIVE CONTROL: exactly 'VALID' confirms.
const valid = await provider(respond('VALID')).confirmNotification(notification);
r.eq('case 1: VALID confirms', valid, { confirmed: true });

// Case 2 — THE WIRE SHAPE. Exact URL, method, content type, and byte-exact body.
r.eq('case 2: one HTTP call made', calls.length, 1);
if (calls.length === 1) {
  const [{ url, init }] = calls;
  r.eq('case 2: validate URL', url, golden.constants.validateUrl);
  r.eq('case 2: method', init?.method, 'POST');
  const ct = init?.headers?.['Content-Type'] ?? init?.headers?.['content-type'];
  r.eq('case 2: content type', ct, 'application/x-www-form-urlencoded');
  // Byte-exact, inbound-builder body — the assertion that catches a switch to the outbound builder.
  r.eq('case 2: body is the INBOUND param string, byte-exact', init?.body, g.notifyParamString);
}

// Case 3 — surrounding whitespace is trimmed before comparison (today: `.trim() !== 'VALID'`).
r.eq('case 3: whitespace-padded VALID confirms', await provider(respond('  VALID \n')).confirmNotification(notification), { confirmed: true });

// Case 4 — everything else is a refusal, and the match is NOT a substring or case-insensitive test.
for (const bad of ['INVALID', 'valid', 'Valid', 'VALID!', 'NOT VALID', '', 'VALIDATION FAILED']) {
  const out = await provider(respond(bad)).confirmNotification(notification);
  r.eq(`case 4: ${JSON.stringify(bad)} refused`, out, { confirmed: false, reason: 'not-valid' });
}

// Case 5 — a thrown/rejected fetch becomes a refusal, never an exception and never a confirmation.
const thrown = await provider(() => { throw new Error('socket hang up'); }).confirmNotification(notification);
r.eq('case 5: fetch throw becomes request-failed', thrown, { confirmed: false, reason: 'request-failed' });
const rejected = await createPayfastProvider({
  env: { PAYFAST_SANDBOX_MERCHANT_ID: '1', PAYFAST_SANDBOX_MERCHANT_KEY: 'k', PAYFAST_SANDBOX_PASSPHRASE: g.passphrase },
  fetch: async () => Promise.reject(new Error('ECONNRESET')),
}).confirmNotification(notification);
r.eq('case 5: fetch rejection becomes request-failed', rejected, { confirmed: false, reason: 'request-failed' });

// Case 6 — NON-VACUITY: the confirmed and refused verdicts are genuinely different values, so
// cases 1-5 cannot all be satisfied by a constant return.
r.ok('case 6: confirm and refuse are distinguishable', valid.confirmed === true && thrown.confirmed === false);

r.done();
