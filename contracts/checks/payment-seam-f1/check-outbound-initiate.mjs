#!/usr/bin/env node
// A1 — OUTBOUND WIRE EQUIVALENCE. The PayFast adapter's initiate() must reproduce today's
// checkout signing byte-for-byte: the same eight fields, in the same INSERTION ORDER (which IS
// the signature base-string order — PayFast uses attribute order, not alphabetical), the same
// process URL, and the same MD5 digest on both the passphrase-present and passphrase-absent paths.
//
// WHAT MAKES THIS FAIL: the module not existing (pre-move — an unresolved import, which is how
// this assertion is observed failing against unfixed code); any field renamed, added, dropped or
// REORDERED; amount or URL construction changed; the signature computed over a different base
// string; the passphrase truthiness test changed from `if (passphrase)` to a null check.
//
// Every credential below is fabricated. 10000100 is PayFast's own published sandbox demo id.
//
// Run as: npx tsx contracts/checks/payment-seam-f1/check-outbound-initiate.mjs

import { createPayfastProvider } from '../../../lib/payments/payfast.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A1 outbound initiate equivalence');
const g = golden.outbound;
const input = {
  reference: g.inputs.reference,
  amountFormatted: g.inputs.amountFormatted,
  itemName: g.inputs.itemName,
  returnUrl: g.inputs.returnUrl,
  cancelUrl: g.inputs.cancelUrl,
  notifyUrl: g.inputs.notifyUrl,
};

const baseEnv = {
  PAYFAST_SANDBOX_MERCHANT_ID: g.inputs.merchantId,
  PAYFAST_SANDBOX_MERCHANT_KEY: g.inputs.merchantKey,
};

// Case 1 — POSITIVE CONTROL, passphrase present. If the harness were rejecting everything (the
// false-green shape this project has hit before), this case would fail loudly rather than pass
// silently alongside the others.
const withPass = await createPayfastProvider({
  env: { ...baseEnv, PAYFAST_SANDBOX_PASSPHRASE: g.inputs.passphrase },
}).initiate(input);
r.ok('case 1: initiate succeeds with full credentials', withPass.ok === true, JSON.stringify(withPass));
if (withPass.ok) {
  r.eq('case 1: processUrl', withPass.processUrl, golden.constants.processUrl);
  r.eq('case 1: method', withPass.method, 'POST');
  // Field ORDER, not just field membership — a Set-equality check here would be exactly the
  // "assertion satisfiable by something that is not the property under test" defect class.
  r.eq('case 1: field key order (signature last)', Object.keys(withPass.fields), [...g.fieldOrder, 'signature']);
  const { signature, ...signed } = withPass.fields;
  r.eq('case 1: signed field values', signed, g.signedFields);
  r.eq('case 1: signature (passphrase present)', signature, g.signatureWithPassphrase);
}

// Case 2 — passphrase ABSENT. Today checkout passes a possibly-undefined passphrase straight
// through; generateSignature folds it in only when truthy. Checkout has NO passphrase guard
// (the ITN route does) and F1 must not add one.
const noPass = await createPayfastProvider({ env: { ...baseEnv } }).initiate(input);
r.ok('case 2: initiate still succeeds with no passphrase', noPass.ok === true, JSON.stringify(noPass));
if (noPass.ok) r.eq('case 2: signature (passphrase absent)', noPass.fields.signature, g.signatureWithoutPassphrase);

// Case 3 — EMPTY-STRING passphrase must behave identically to absent (`if (passphrase)`).
const emptyPass = await createPayfastProvider({
  env: { ...baseEnv, PAYFAST_SANDBOX_PASSPHRASE: '' },
}).initiate(input);
r.ok('case 3: initiate succeeds with empty passphrase', emptyPass.ok === true, JSON.stringify(emptyPass));
if (emptyPass.ok) r.eq('case 3: signature (empty passphrase)', emptyPass.fields.signature, g.signatureWithEmptyStringPassphrase);

// Case 4 — NON-VACUITY. The two digests must actually differ, or cases 1-3 would be satisfied by
// an implementation that ignores the passphrase entirely.
r.ok(
  'case 4: passphrase-present and passphrase-absent digests differ',
  g.signatureWithPassphrase !== g.signatureWithoutPassphrase,
  'the golden itself would be degenerate if these matched'
);

// Case 5 — the signature is over the OTHER EIGHT fields only, never over itself.
if (withPass.ok) {
  r.ok(
    'case 5: signature is not itself part of the signed set',
    !g.paramString.includes('signature='),
    'golden param string must not contain a signature= pair'
  );
}

r.done();
