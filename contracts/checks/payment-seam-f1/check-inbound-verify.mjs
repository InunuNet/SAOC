#!/usr/bin/env node
// A2 — INBOUND ITN VERIFICATION EQUIVALENCE + TAMPER SUITE. This is the assertion that decides
// whether someone can mint themselves a paid ticket for free through the seam. It runs the
// adapter's verifyNotification() over a genuine golden ITN body and then over seven mutated
// variants, and requires the same accept/reject verdicts today's inline guard produces.
//
// WHAT MAKES THIS FAIL: the module not existing (pre-move); the OUTBOUND signature algorithm
// being reused for inbound verification (the exact defect ticketing-F10 was opened to fix — a
// real ITN always contains blank fields, so the trim/blank-skip outbound builder can never match
// it); `continue` instead of `break` at the posted signature key; the passphrase guard being
// dropped, moved after the digest, or weakened to a null check; posted field ORDER not being
// preserved; the source-IP result being allowed to flip `verified` to false.
//
// Offline and credential-free: no network, no DNS, no process.env read — env and IP resolution
// are both injected. Every value is fabricated test data.
//
// Run as: npx tsx contracts/checks/payment-seam-f1/check-inbound-verify.mjs

import { createPayfastProvider } from '../../../lib/payments/payfast.ts';
import { generateNotifySignature } from '../../../lib/payfast.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A2 inbound verifyNotification equivalence');
const g = golden.inbound;

const PASS = g.passphrase;
const OTHER_MERCHANT_PASS = 'a-different-merchants-test-passphrase';

let ipResolutions = 0;

/**
 * `null` — NOT `undefined` — is the sentinel for "the passphrase is genuinely absent from the
 * environment". JS default parameters fire on `undefined`, so an earlier version of this helper
 * gave the parameter a default and case 7 passed it `undefined`: the default silently rebuilt the
 * real golden passphrase, and the case became unsatisfiable — passing it would have required
 * rejecting a correctly-signed notification, contradicting case 1. There is now no default value
 * and the test is `== null`, which catches the sentinel while still letting `''` through as its
 * own distinct case (7b). Do not reintroduce a default here.
 *
 * (Deliberately paraphrased rather than quoting the old broken line: a reviewer grepping for the
 * defective code to check whether it was fixed would otherwise match this comment and conclude it
 * had not been. That happened once already.)
 */
function provider(passphrase) {
  ipResolutions = 0;
  return createPayfastProvider({
    env: {
      PAYFAST_SANDBOX_MERCHANT_ID: '10000100',
      PAYFAST_SANDBOX_MERCHANT_KEY: 'test-merchant-key-not-real',
      ...(passphrase == null ? {} : { PAYFAST_SANDBOX_PASSPHRASE: passphrase }),
    },
    resolveTrustedIps: async () => {
      ipResolutions += 1;
      return new Set(['197.97.145.144']);
    },
    fetch: async () => {
      throw new Error('verifyNotification must never make an HTTP call');
    },
  });
}

/** Encodes fields the way PayFast posts them, preserving order. */
function body(fields, signature) {
  const parts = Object.entries(fields).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  );
  if (signature !== undefined) parts.push(`signature=${signature}`);
  return parts.join('&');
}

const req = (raw, xff = '197.97.145.144,10.0.0.1') => ({
  rawBody: raw,
  headers: { get: (n) => (n.toLowerCase() === 'x-forwarded-for' ? xff : null) },
});

// Case 1 — POSITIVE CONTROL: a genuine, correctly-signed ITN is ACCEPTED and every extracted
// field carries the exact posted value. Checked first: if this fails, every rejection below is
// meaningless, because a harness that rejects everything would "pass" all of them.
const genuine = body(g.fields, g.notifySignatureWithPassphrase);
const ok = await provider(PASS).verifyNotification(req(genuine));
r.ok('case 1: genuine ITN verified', ok.verified === true, JSON.stringify(ok));
if (ok.verified) {
  const n = ok.notification;
  r.eq('case 1: reference', n.reference, g.fields.m_payment_id);
  r.eq('case 1: rawStatus', n.rawStatus, g.fields.payment_status);
  r.eq('case 1: grossAmount is the UNPARSED string', n.grossAmount, g.fields.amount_gross);
  r.eq('case 1: gatewayPaymentId', n.gatewayPaymentId, g.fields.pf_payment_id);
  // Posted ORDER preserved, blanks included — this is what the inbound digest is computed over.
  r.eq('case 1: raw field order preserved, blanks kept', Object.keys(n.raw), g.fieldOrder);
  r.eq('case 1: raw field values', n.raw, g.fields);
  r.ok('case 1: signature field excluded from raw', !('signature' in n.raw));
}

// Case 2 — the digest is the pinned INBOUND one, not the outbound one. A signature computed with
// the outbound algorithm over the same fields is REJECTED. This is the F10 defect, re-armed.
r.ok(
  'case 2: inbound and outbound digests over the same fields differ',
  g.notifySignatureWithPassphrase !== golden.builderDivergence.inboundSignatureWithPaddedItemName,
  'sanity: golden vectors are distinct'
);
const outboundStyle = await provider(PASS).verifyNotification(
  req(body(g.fields, golden.outbound.signatureWithPassphrase))
);
r.ok('case 2: a foreign digest is rejected', outboundStyle.verified === false);
if (!outboundStyle.verified) r.eq('case 2: reason', outboundStyle.reason, 'signature-mismatch');

// Case 3 — tampered amount_gross.
const tampered = await provider(PASS).verifyNotification(
  req(body({ ...g.fields, amount_gross: '1.00' }, g.notifySignatureWithPassphrase))
);
r.ok('case 3: tampered amount rejected', tampered.verified === false);

// Case 4 — same fields, REVERSED order, original signature replayed. Catches an implementation
// that sorts or normalises field order before hashing.
const reversed = Object.fromEntries(Object.entries(g.fields).reverse());
const reordered = await provider(PASS).verifyNotification(
  req(body(reversed, g.notifySignatureWithPassphrase))
);
r.ok('case 4: reordered fields with replayed signature rejected', reordered.verified === false);

// Case 5 — missing and empty signature.
const missing = await provider(PASS).verifyNotification(req(body(g.fields, undefined)));
r.ok('case 5a: missing signature rejected', missing.verified === false);
if (!missing.verified) r.eq('case 5a: reason', missing.reason, 'missing-signature');
const empty = await provider(PASS).verifyNotification(req(body(g.fields, '')));
r.ok('case 5b: empty signature rejected', empty.verified === false);

// Case 6 — correctly-structured signature computed with a DIFFERENT merchant's passphrase. The
// body is well-formed and the algorithm is right; only the shared secret is wrong.
const otherSig = generateNotifySignature(g.fields, OTHER_MERCHANT_PASS);
r.ok('case 6: sanity — the foreign digest differs from the genuine one', otherSig !== g.notifySignatureWithPassphrase);
const forged = await provider(PASS).verifyNotification(req(body(g.fields, otherSig)));
r.ok('case 6: foreign-passphrase signature rejected', forged.verified === false);
if (!forged.verified) r.eq('case 6: reason', forged.reason, 'signature-mismatch');

// Case 7 — PASSPHRASE ABSENT must fail closed BEFORE any digest is computed. Without this, an
// unset passphrase degrades verification to a plain MD5 over publicly-known fields and anyone can
// mark their own unpaid order paid.
const noPass = await provider(null).verifyNotification(req(genuine));
r.ok('case 7: unset passphrase fails closed', noPass.verified === false);
if (!noPass.verified) r.eq('case 7: reason', noPass.reason, 'not-configured');
r.eq('case 7: no DNS resolution attempted on the not-configured path', ipResolutions, 0);
const emptyPass = await provider('').verifyNotification(req(genuine));
r.ok('case 7b: empty-string passphrase fails closed', emptyPass.verified === false);

// Case 8 — `break` (not `continue`) at the posted signature key: a field posted AFTER signature
// is excluded from the parsed set. Dormant against PayFast today (it posts signature last), but a
// `continue`-based parse hashes fields PayFast's own reference algorithm never included.
const trailing = `${genuine}&injected_field=attacker`;
const afterSig = await provider(PASS).verifyNotification(req(trailing));
r.ok('case 8: still verified with a field after signature', afterSig.verified === true, JSON.stringify(afterSig));
if (afterSig.verified) {
  r.ok('case 8: post-signature field excluded from raw', !('injected_field' in afterSig.notification.raw));
}

// Case 9 — missing m_payment_id is rejected AFTER the signature check, not before.
const noRefFields = Object.fromEntries(Object.entries(g.fields).filter(([k]) => k !== 'm_payment_id'));
const noRef = await provider(PASS).verifyNotification(req(body(noRefFields, 'not-a-valid-signature')));
r.ok('case 9: bad signature beats missing reference', noRef.verified === false);
if (!noRef.verified) {
  r.eq('case 9: signature is checked first', noRef.reason, 'signature-mismatch');
}

// Case 10 — SOURCE IP IS ADVISORY ONLY. Since 2026-08-18 the source-IP check is logged, never
// enforced: a real signature-verified sandbox ITN arrived from an IP outside the resolved host
// set, and enforcing it rejected genuine payments. An untrusted IP must NOT flip `verified`.
const untrusted = await createPayfastProvider({
  env: { PAYFAST_SANDBOX_MERCHANT_ID: '10000100', PAYFAST_SANDBOX_MERCHANT_KEY: 'k', PAYFAST_SANDBOX_PASSPHRASE: PASS },
  resolveTrustedIps: async () => new Set(['1.2.3.4']),
  fetch: async () => { throw new Error('no HTTP in verifyNotification'); },
}).verifyNotification(req(genuine, '35.219.200.118,10.0.0.1'));
r.ok('case 10: untrusted source IP still verifies', untrusted.verified === true, JSON.stringify(untrusted));
if (untrusted.verified) {
  r.eq('case 10: sourceIp is the second-to-last XFF hop', untrusted.notification.sourceIp, '35.219.200.118');
  r.eq('case 10: sourceIpTrusted reports false', untrusted.notification.sourceIpTrusted, false);
}

r.done();
