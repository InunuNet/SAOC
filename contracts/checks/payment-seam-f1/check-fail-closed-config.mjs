#!/usr/bin/env node
// A4 — FAIL-CLOSED CREDENTIAL GUARDS. Missing merchant credentials must refuse the initiation
// outright, returning a refusal that carries NO fields and NO signature — never a half-built or
// unsigned form the caller could accidentally post. Mirrors app/api/tickets/checkout/route.ts:311.
//
// Case 5 is the one that matters most and has no equivalent in the current code: env must be read
// PER CALL, not captured at module load. Firebase App Hosting supplies these variables with
// RUNTIME availability only, so a factory that snapshots process.env at import time would refuse
// every real purchase in production while passing every offline test that sets env before import.
//
// WHAT MAKES THIS FAIL: the module not existing (pre-move); a missing credential throwing instead
// of returning a refusal; a refusal that still carries `fields` or `processUrl`; empty-string
// credentials being treated as present (today's `!merchantId` treats them as missing); config read
// once at construction.
//
// Run as: npx tsx contracts/checks/payment-seam-f1/check-fail-closed-config.mjs

import { createPayfastProvider } from '../../../lib/payments/payfast.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A4 fail-closed credential guards');
const o = golden.outbound;
const input = {
  reference: o.inputs.reference,
  amountFormatted: o.inputs.amountFormatted,
  itemName: o.inputs.itemName,
  returnUrl: o.inputs.returnUrl,
  cancelUrl: o.inputs.cancelUrl,
  notifyUrl: o.inputs.notifyUrl,
};
const ID = o.inputs.merchantId;
const KEY = o.inputs.merchantKey;

async function initiateWith(env, caseName) {
  try {
    return await createPayfastProvider({ env }).initiate(input);
  } catch (error) {
    r.ok(`${caseName}: refuses by return value, never by throwing`, false, String(error));
    return { ok: false, reason: 'threw' };
  }
}

// Case 1 — POSITIVE CONTROL. With both credentials present the call succeeds. Without this, an
// implementation that refused unconditionally would satisfy cases 2-4.
const good = await initiateWith({ PAYFAST_SANDBOX_MERCHANT_ID: ID, PAYFAST_SANDBOX_MERCHANT_KEY: KEY }, 'case 1');
r.ok('case 1: full credentials succeed', good.ok === true, JSON.stringify(good));

const refusals = [
  ['case 2: merchant id missing', { PAYFAST_SANDBOX_MERCHANT_KEY: KEY }],
  ['case 3: merchant key missing', { PAYFAST_SANDBOX_MERCHANT_ID: ID }],
  ['case 4a: both missing', {}],
  ['case 4b: merchant id empty string', { PAYFAST_SANDBOX_MERCHANT_ID: '', PAYFAST_SANDBOX_MERCHANT_KEY: KEY }],
  ['case 4c: merchant key empty string', { PAYFAST_SANDBOX_MERCHANT_ID: ID, PAYFAST_SANDBOX_MERCHANT_KEY: '' }],
];
for (const [name, env] of refusals) {
  const result = await initiateWith(env, name);
  r.ok(`${name}: refused`, result.ok === false, JSON.stringify(result));
  if (result.ok === false) {
    r.eq(`${name}: reason`, result.reason, 'not-configured');
    // A refusal must be inert: nothing a caller could mistake for a postable form.
    r.ok(`${name}: refusal carries no fields`, !('fields' in result), JSON.stringify(result));
    r.ok(`${name}: refusal carries no processUrl`, !('processUrl' in result), JSON.stringify(result));
  }
}

// Case 5 — CONFIG IS READ PER CALL, NOT AT CONSTRUCTION. The same provider instance is called
// twice against a MUTATED env object: refused first, accepted second. A factory that snapshotted
// its config would refuse both.
const mutableEnv = {};
const late = createPayfastProvider({ env: mutableEnv });
const before = await late.initiate(input);
r.ok('case 5: refused while env is empty', before.ok === false, JSON.stringify(before));
mutableEnv.PAYFAST_SANDBOX_MERCHANT_ID = ID;
mutableEnv.PAYFAST_SANDBOX_MERCHANT_KEY = KEY;
mutableEnv.PAYFAST_SANDBOX_PASSPHRASE = o.inputs.passphrase;
const after = await late.initiate(input);
r.ok('case 5: same instance succeeds once env is populated', after.ok === true, JSON.stringify(after));
if (after.ok) {
  r.eq('case 5: and it signs correctly with the late-supplied passphrase', after.fields.signature, o.signatureWithPassphrase);
}

r.done();
