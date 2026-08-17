#!/usr/bin/env node
// F10 (ticketing-foundation) — the `parseOrderedFields` `continue`-vs-`break` fix.
//
// CORRECTION, recorded here rather than re-derived (matching F1's precedent of documenting a
// mission-brief inaccuracy instead of silently reproducing it): the CURRENT (pre-F10) route
// already reads `continue`, not `break` — confirmed by reading app/api/tickets/itn/route.ts:69
// during architect design, 2026-08-17. It is NOT a live bug in the sense of "signature
// verification is broken today" — PayFast always posts `signature` last, so `continue` and
// `break` behave identically for every real ITN seen so far. It IS a genuine divergence from
// PayFast's own documented reference implementation (which uses `break`, stopping iteration
// the instant `signature` is reached — see contracts/golden/payfast-itn-signature/
// inbound-algorithm.golden.md, and docs/payfast-itn-signature.md's own "Known Remaining
// Defect" section, written 2026-08-16, one day before this contract). `continue` would
// silently include any field that happened to arrive AFTER `signature` in the digest — a
// digest PayFast's own `break`-based algorithm never included — which would reject a
// genuinely valid ITN the moment PayFast's field order ever changed (an availability/
// reliability risk, not a forgery risk: it fails closed, just for the wrong reason). F10's
// fix is to move to `break`, removing that latent fragility and matching the spec exactly.
//
// DIMENSION THAT VARIES ACROSS CASES, checked personally to confirm it isn't vacuous: case
// (1) is the ordinary, currently-universal shape (signature last) and must keep working
// unchanged — a regression guard against a fix that breaks the common case while fixing the
// edge case. Case (2) is the ONLY dimension that distinguishes break from continue: a field
// physically present AFTER `signature` in posted order. `continue` includes it in `fields`;
// `break` excludes it. Reverting `break` to `continue` makes case (2) fail while leaving case
// (1) passing — this is the exact defeating mutation this check exists to catch.
//
// Run as: npx tsx contracts/checks/ticketing-f10-itn-repin/check-break-fix-field-order.mjs

import { parseOrderedFields } from '../../../app/api/tickets/itn/route.ts';

const failures = [];

// (1) Ordinary shape — signature last, several fields before it (including blanks, matching
// real PayFast ITN bodies). NON-VACUOUS positive control: every field before signature must
// be captured with its EXACT value, not merely "some non-empty result".
{
  const raw = 'm_payment_id=SAOC-2027-TESTBREAK01&amount_gross=250.00&name_last=&payment_status=COMPLETE&signature=abc123';
  const { fields, signature } = parseOrderedFields(raw);

  if (signature !== 'abc123') failures.push(`(1) signature was ${JSON.stringify(signature)}, expected 'abc123'.`);
  if (fields['m_payment_id'] !== 'SAOC-2027-TESTBREAK01') failures.push(`(1) fields.m_payment_id was ${JSON.stringify(fields['m_payment_id'])}, expected 'SAOC-2027-TESTBREAK01'.`);
  if (fields['amount_gross'] !== '250.00') failures.push(`(1) fields.amount_gross was ${JSON.stringify(fields['amount_gross'])}, expected '250.00'.`);
  if (fields['name_last'] !== '') failures.push(`(1) fields.name_last was ${JSON.stringify(fields['name_last'])}, expected '' (blank fields must not be dropped).`);
  if (fields['payment_status'] !== 'COMPLETE') failures.push(`(1) fields.payment_status was ${JSON.stringify(fields['payment_status'])}, expected 'COMPLETE'.`);
  if ('signature' in fields) failures.push('(1) the returned `fields` object must not contain a `signature` key.');
}

// (2) THE defeating case — a field physically appears AFTER `signature` in posted order.
// `break` (F10, correct) must stop iteration at `signature` and NEVER add `trailing_field` to
// `fields`. `continue` (pre-F10) would add it. This never happens with a real PayFast ITN
// (signature is always posted last) — it exists to prove the code matches the documented
// algorithm exactly, not merely "whatever PayFast happens to send today".
{
  const raw = 'm_payment_id=SAOC-2027-TESTBREAK02&signature=abc123&trailing_field=should-not-be-captured';
  const { fields, signature } = parseOrderedFields(raw);

  if (signature !== 'abc123') failures.push(`(2) signature was ${JSON.stringify(signature)}, expected 'abc123'.`);
  if (fields['m_payment_id'] !== 'SAOC-2027-TESTBREAK02') failures.push(`(2) fields.m_payment_id was ${JSON.stringify(fields['m_payment_id'])}, expected 'SAOC-2027-TESTBREAK02'.`);
  if ('trailing_field' in fields) {
    failures.push("(2) `fields` contained `trailing_field`, a field posted AFTER `signature` — parseOrderedFields did not stop (`break`) at `signature`; it kept going (`continue`). This is the exact continue-vs-break divergence F10 fixes.");
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: parseOrderedFields captures every field before `signature` (including blanks) with ' +
    'exact values, excludes `signature` itself from `fields`, and — the defeating case — stops ' +
    'iteration at `signature` rather than continuing past it, matching PayFast\'s own documented ' +
    'reference algorithm exactly.'
);
process.exit(0);
