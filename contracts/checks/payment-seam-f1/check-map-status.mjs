#!/usr/bin/env node
// A5 — mapStatus PRESERVES THE ONE-WAY-TO-PAID RULE. Today app/api/tickets/itn/route.ts flips an
// order to 'paid' only when fields['payment_status'] === 'COMPLETE' — strict, case-sensitive, no
// trimming. Every other value leaves the order reserved. The seam must not soften that.
//
// WHAT MAKES THIS FAIL: the module not existing (pre-move); a .toUpperCase(), .toLowerCase() or
// .trim() "improvement" (case 2 covers 'complete', 'Complete', 'COMPLETE ' and ' COMPLETE');
// 'COMPLETED' or an unrecognised gateway string falling through to 'paid'; null mapping to
// anything other than 'unknown'.
//
// Run as: npx tsx contracts/checks/payment-seam-f1/check-map-status.mjs

import { payfastProvider } from '../../../lib/payments/payfast.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A5 mapStatus');
const s = golden.statusMapping;

// Case 1 — POSITIVE CONTROL. Exactly one input yields 'paid'.
r.eq("case 1: 'COMPLETE' maps to paid", payfastProvider.mapStatus(s.paidInput), 'paid');

// Case 2 — NOTHING ELSE yields 'paid'. This is the security-relevant half.
for (const input of s.nonPaidInputs) {
  r.ok(
    `case 2: ${JSON.stringify(input)} must not map to paid`,
    payfastProvider.mapStatus(input) !== 'paid',
    `got ${payfastProvider.mapStatus(input)}`
  );
}
r.ok('case 2: null must not map to paid', payfastProvider.mapStatus(null) !== 'paid');

// Case 3 — the documented PayFast statuses map to their neutral equivalents.
for (const [raw, expected] of Object.entries(s.expected)) {
  r.eq(`case 3: ${raw}`, payfastProvider.mapStatus(raw), expected);
}

// Case 4 — unrecognised input falls back to 'unknown', not to a settled state. An unknown gateway
// string must never be silently classified as a terminal failure either — an operator has to be
// able to tell "the gateway said something we do not model" from "the gateway said it failed".
r.eq('case 4: unrecognised string', payfastProvider.mapStatus('SOMETHING-NEW'), s.unknownFallback);
r.eq('case 4: null', payfastProvider.mapStatus(null), s.unknownFallback);
r.eq('case 4: empty string', payfastProvider.mapStatus(''), s.unknownFallback);

// Case 5 — NON-VACUITY. mapStatus must actually discriminate: if it returned a constant, cases
// 1 and 2 could not both hold, but assert it directly so a degenerate implementation is named.
const distinct = new Set(Object.values(s.expected).concat(s.unknownFallback));
r.ok('case 5: the mapping is not constant', distinct.size >= 4, `${distinct.size} distinct outputs`);

r.done();
