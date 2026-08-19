#!/usr/bin/env node
// A3 — THE TWO SIGNATURE ALGORITHMS MUST NOT BE UNIFIED, observed THROUGH THE SEAM.
//
// PayFast documents two genuinely different parameter-string algorithms: the OUTBOUND one used to
// sign the checkout form (trims values, skips blank fields) and the INBOUND one used to verify an
// ITN and to build the server-confirm body (no trim, no blank-skip). Collapsing them into one
// "shared helper" is the single most likely mistake a pure move can make — and it is precisely
// what ticketing-F10 was opened to fix after an earlier version of lib/payfast.ts reused the
// outbound builder for the inbound path, producing a digest a real ITN can never match.
//
// This check makes the divergence observable at the SEAM's own surface rather than by grepping
// for two function names: the same padded item name is fed to initiate() and to
// verifyNotification(), and the pinned digests must both hold. Under unification, exactly one of
// the two changes — whichever algorithm survives — so one of these cases goes red no matter which
// direction the collapse happens in.
//
// WHAT MAKES THIS FAIL: the module not existing (pre-move); the adapter routing initiate() through
// the inbound builder; the adapter routing verifyNotification() through the outbound builder; any
// added .trim() or blank-skip on the inbound path; any removed .trim() on the outbound path.
//
// Run as: npx tsx contracts/checks/payment-seam-f1/check-builder-divergence.mjs

import { createPayfastProvider } from '../../../lib/payments/payfast.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A3 outbound/inbound builder divergence');
const d = golden.builderDivergence;
const o = golden.outbound;

// Case 1 — OUTBOUND TRIMS. A padded item name produces a signature IDENTICAL to the unpadded one,
// because the outbound builder trims. If the adapter used the inbound (no-trim) algorithm here,
// this digest changes.
const withPadding = await createPayfastProvider({
  env: {
    PAYFAST_SANDBOX_MERCHANT_ID: o.inputs.merchantId,
    PAYFAST_SANDBOX_MERCHANT_KEY: o.inputs.merchantKey,
    PAYFAST_SANDBOX_PASSPHRASE: o.inputs.passphrase,
  },
}).initiate({
  reference: o.inputs.reference,
  amountFormatted: o.inputs.amountFormatted,
  itemName: d.paddedItemName,
  returnUrl: o.inputs.returnUrl,
  cancelUrl: o.inputs.cancelUrl,
  notifyUrl: o.inputs.notifyUrl,
});
r.ok('case 1: initiate succeeded', withPadding.ok === true, JSON.stringify(withPadding));
if (withPadding.ok) {
  r.eq('case 1: outbound digest with padded item name', withPadding.fields.signature, d.outboundSignatureWithPaddedItemName);
  r.eq(
    'case 1: outbound is trim-insensitive (same digest as the unpadded golden)',
    d.outboundSignatureWithPaddedItemName,
    o.signatureWithPassphrase
  );
}

// Case 2 — INBOUND DOES NOT TRIM AND DOES NOT SKIP BLANKS. The same padding, and two blank fields,
// change the inbound digest. An ITN signed over the padded values verifies; one signed over
// trimmed/blank-skipped values does not.
function body(fields, signature) {
  const parts = Object.entries(fields).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return `${parts.join('&')}&signature=${signature}`;
}
const req = (raw) => ({ rawBody: raw, headers: { get: () => null } });
const provider = createPayfastProvider({
  env: {
    PAYFAST_SANDBOX_MERCHANT_ID: o.inputs.merchantId,
    PAYFAST_SANDBOX_MERCHANT_KEY: o.inputs.merchantKey,
    PAYFAST_SANDBOX_PASSPHRASE: golden.inbound.passphrase,
  },
  resolveTrustedIps: async () => new Set(),
  fetch: async () => { throw new Error('no HTTP in verifyNotification'); },
});

const padded = await provider.verifyNotification(
  req(body(d.inboundFieldsWithPaddedItemName, d.inboundSignatureWithPaddedItemName))
);
r.ok('case 2: padded-value ITN verifies against the no-trim digest', padded.verified === true, JSON.stringify(padded));
if (padded.verified) {
  r.eq(
    'case 2: blank fields survive into the parsed set',
    Object.keys(padded.notification.raw),
    Object.keys(d.inboundFieldsWithPaddedItemName)
  );
  r.eq('case 2: padded value is NOT trimmed', padded.notification.raw.item_name, d.paddedItemName);
}

// Case 3 — NON-VACUITY / the collapse detector. The outbound digest over the padded fields and the
// inbound digest over the padded fields must be different values. If a future "cleanup" unified
// the two builders, the adapter would necessarily produce the same digest on both sides for the
// same content, and this case is the one that names that directly.
r.ok(
  'case 3: the two algorithms produce different digests for the same padded content',
  d.outboundSignatureWithPaddedItemName !== d.inboundSignatureWithPaddedItemName,
  `${d.outboundSignatureWithPaddedItemName} vs ${d.inboundSignatureWithPaddedItemName}`
);

// Case 4 — the inbound digest is order- and blank-sensitive in the way a unified builder is not:
// the SAME fields with blanks stripped must NOT verify against the padded signature.
const blanksStripped = Object.fromEntries(
  Object.entries(d.inboundFieldsWithPaddedItemName).filter(([, v]) => v !== '')
);
const stripped = await provider.verifyNotification(req(body(blanksStripped, d.inboundSignatureWithPaddedItemName)));
r.ok('case 4: blank-skipped body rejected against the no-blank-skip digest', stripped.verified === false);

r.done();
