#!/usr/bin/env node
// F10 (ticketing-foundation) — the ITN signature-verification brutal suite. This is the
// assertion that decides whether someone can mint themselves a paid ticket for free: it
// proves a genuine ITN is accepted and a tampered/forged/malformed one is rejected, using the
// SAME pipeline the notification route's guard 1 uses — parseOrderedFields (exported
// from the pinned route) feeding generateNotifySignature/buildPayfastNotifyParamString
// (lib/payfast.ts). Never imports the Next.js route handler itself (importing a route module
// outside the Next runtime is fragile); the sha256 pin (A8 in the contract) is the separate
// proof that the route actually wires these functions together the way this script assumes.
//
// Test values only. PAYFAST_SANDBOX_PASSPHRASE is never read here and no value in this file
// could be mistaken for a real PayFast credential — this project is sandboxed, and this check
// is offline and credential-free (no network call, no env var read).
//
// DIMENSION THAT VARIES ACROSS CASES, checked personally to confirm it isn't vacuous: every
// case starts from the SAME base field set and the SAME correctly-computed signature (case 1),
// then mutates exactly ONE thing about the wire body (amount, payment id, field order,
// signature presence, or the passphrase used to sign) before re-running it through the
// IDENTICAL parse+recompute+compare pipeline as case 1. Case 1 is the non-vacuous positive
// control: if the harness rejected everything (the exact false-green shape named in the
// mission brief — F4's A3, F5's A3, F7's A2), case 1 would fail loudly, not silently pass
// alongside the rejections.
//
// Run as: npx tsx contracts/checks/ticketing-f10-itn-repin/check-signature-brutal.mjs

import { parseOrderedFields } from '../../../lib/payments/payfast.ts';
import { buildPayfastNotifyParamString, generateNotifySignature } from '../../../lib/payfast.ts';

const failures = [];

const PASSPHRASE = 'test-passphrase-not-real';
const OTHER_MERCHANT_PASSPHRASE = 'other-merchant-test-passphrase';

// Realistic field set: PayFast's ITN payload order, including the blank fields real sandbox
// notifications always send (name_last, custom_str*, custom_int*, item_description) — the
// exact shape that made the pre-F10 (trim + skip-blank outbound) builder always mismatch.
const BASE_FIELDS = {
  m_payment_id: 'SAOC-2027-TESTBRUTAL01',
  pf_payment_id: '9999001',
  payment_status: 'COMPLETE',
  item_name: 'SAOC National Show Ticket',
  item_description: '',
  amount_gross: '250.00',
  amount_fee: '-10.00',
  amount_net: '240.00',
  custom_str1: '',
  custom_str2: '',
  custom_str3: '',
  custom_str4: '',
  custom_str5: '',
  custom_int1: '',
  custom_int2: '',
  custom_int3: '',
  custom_int4: '',
  custom_int5: '',
  name_first: 'Test',
  name_last: '',
  email_address: 'buyer@example.com',
  merchant_id: 'TEST-MERCHANT-00000001',
};

/** Builds a raw ITN body: buildPayfastNotifyParamString(fields) + '&signature=' + signature. */
function rawBody(fields, signature) {
  const paramString = buildPayfastNotifyParamString(fields);
  if (signature === undefined) return paramString; // no signature field at all
  return `${paramString}&signature=${signature}`;
}

/** Mirrors route.ts guard 1 exactly: parse, recompute over the PARSED fields, compare. */
function verify(raw, passphrase = PASSPHRASE) {
  const { fields, signature } = parseOrderedFields(raw);
  const expected = generateNotifySignature(fields, passphrase);
  const accepted = Boolean(signature) && expected === signature;
  return { accepted, fields, signature };
}

const validSignature = generateNotifySignature(BASE_FIELDS, PASSPHRASE);

// (1) POSITIVE CONTROL — a genuine, unmodified ITN is ACCEPTED. If this fails, every rejection
// below is meaningless (the harness could be rejecting everything).
{
  const { accepted } = verify(rawBody(BASE_FIELDS, validSignature));
  if (!accepted) {
    failures.push('(1) A genuine, unmodified ITN was REJECTED — the positive control failed, which invalidates every other case in this suite.');
  }
}

// (2) Tampered amount_gross, signature left unchanged (the real shape of a MITM/tamper
// attempt — an attacker cannot recompute a matching signature without the passphrase).
{
  const tampered = rawBody(BASE_FIELDS, validSignature).replace('amount_gross=250.00', 'amount_gross=999999.00');
  const { accepted } = verify(tampered);
  if (accepted) failures.push('(2) A tampered amount_gross with the ORIGINAL signature was ACCEPTED — an attacker could pay less and be granted the higher-value ticket, or vice versa.');
}

// (3) Tampered m_payment_id, signature left unchanged (an attacker retargets a valid
// signature onto a DIFFERENT reservation's payment id).
{
  const tampered = rawBody(BASE_FIELDS, validSignature).replace('m_payment_id=SAOC-2027-TESTBRUTAL01', 'm_payment_id=SAOC-2027-VICTIMORDER1');
  const { accepted } = verify(tampered);
  if (accepted) failures.push("(3) A tampered m_payment_id with the ORIGINAL signature was ACCEPTED — an attacker could redirect a valid payment confirmation onto someone else's reservation.");
}

// (4) Swapped field order, SAME key/value pairs, ORIGINAL signature (computed on the
// canonical order) reused. The inbound algorithm is posted-order-sensitive by design — a
// reordered body must produce a different digest, so a stolen signature can't be replayed
// against a reordered payload.
{
  const reorderedFields = {};
  const keys = Object.keys(BASE_FIELDS);
  for (const key of [...keys].reverse()) reorderedFields[key] = BASE_FIELDS[key];
  const reorderedBody = `${buildPayfastNotifyParamString(reorderedFields)}&signature=${validSignature}`;
  const { accepted } = verify(reorderedBody);
  if (accepted) failures.push('(4) A body with the SAME fields in REVERSED order, carrying the ORIGINAL signature, was ACCEPTED — the digest is not genuinely order-sensitive.');
}

// (5) Missing signature field entirely.
{
  const { accepted, signature } = verify(rawBody(BASE_FIELDS, undefined));
  if (accepted) failures.push('(5) A body with NO signature field at all was ACCEPTED.');
  if (signature !== null) failures.push(`(5) parseOrderedFields returned signature ${JSON.stringify(signature)} for a body with no signature field — expected null.`);
}

// (6) Empty (present but blank) signature field.
{
  const { accepted, signature } = verify(rawBody(BASE_FIELDS, ''));
  if (accepted) failures.push('(6) A body with an EMPTY signature field was ACCEPTED.');
  if (signature !== '') failures.push(`(6) parseOrderedFields returned signature ${JSON.stringify(signature)} for an empty signature field — expected ''.`);
}

// (7) Signature computed with a DIFFERENT passphrase ("a different merchant") — simulates an
// attacker (or a misconfigured second PayFast account) who can compute valid-looking
// signatures but not for THIS merchant's passphrase.
{
  const otherMerchantSignature = generateNotifySignature(BASE_FIELDS, OTHER_MERCHANT_PASSPHRASE);
  const { accepted } = verify(rawBody(BASE_FIELDS, otherMerchantSignature));
  if (accepted) failures.push("(7) A signature computed with a DIFFERENT merchant's passphrase was ACCEPTED against this merchant's configured passphrase.");
}

// (8) REGRESSION GUARD — buildPayfastNotifyParamString (inbound) must still differ from the
// outbound builder on a fixture with blank fields, proving the split from lib/payfast.ts
// (contract-payfast-itn-signature.yaml, already shipped) hasn't been silently re-merged.
{
  const outboundModule = await import('../../../lib/payfast.ts');
  const outboundString = outboundModule.buildPayfastParamString(BASE_FIELDS);
  const inboundString = buildPayfastNotifyParamString(BASE_FIELDS);
  if (outboundString === inboundString) {
    failures.push('(8) buildPayfastNotifyParamString (inbound) produced IDENTICAL output to buildPayfastParamString (outbound) on a fixture with blank fields — the split has been re-merged.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a genuine ITN is accepted, and a tampered amount, tampered payment id, reordered ' +
    'field set, missing signature, empty signature, and a different-merchant signature are ' +
    'all rejected — proven against the exact parse+recompute+compare pipeline guard 1 uses, ' +
    'never against a live PayFast endpoint.'
);
process.exit(0);
