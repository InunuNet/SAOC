#!/usr/bin/env node
// A5 — mapStatus HANDLES OZOW'S STATUS ENUM STRICTLY (F31 re-pin: six values, Pending included). Ozow's redirect/
// notify Status field is documented as exactly three values: Complete, Cancelled, Error (README
// §1 / spec §0) — unlike PayFast, which has its own vocabulary but is likewise a small closed set.
// F31 re-pin: Pending / PendingInvestigation now legitimately map to 'pending' (case 4); the adapter
// still must not fall through to 'paid' on anything unrecognised.
//
// WHAT MAKES THIS FAIL: the module not existing; 'complete'/'Complete '/' Complete'/'COMPLETE'
// (case or whitespace variants) mapping to 'paid' (must be exact, matching Ozow's own casing);
// 'Error' or an unrecognised string falling through to 'paid'; null mapping to anything but
// 'unknown'; the adapter inventing a 'pending' output for any input.
//
// Run as: npx tsx contracts/checks/ozow-m1-f1/check-map-status.mjs

import { createOzowProvider } from '../../../lib/payments/ozow.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A5 mapStatus 3-value enum');
const s = golden.statusMapping;
const provider = createOzowProvider({ env: {} });

// Case 1 — POSITIVE CONTROL.
r.eq("case 1: 'Complete' maps to paid", provider.mapStatus(s.paidInput), 'paid');

// Case 2 — the other two documented values map to their neutral equivalents.
for (const [raw, expected] of Object.entries(s.expected)) {
  r.eq(`case 2: '${raw}' maps to '${expected}'`, provider.mapStatus(raw), expected);
}

// Case 3 — NOTHING ELSE yields 'paid' — the security-relevant half, including case/whitespace
// variants of 'Complete' itself.
for (const input of s.nonPaidInputs) {
  r.ok(`case 3: ${JSON.stringify(input)} must not map to paid`, provider.mapStatus(input) !== 'paid', `got ${provider.mapStatus(input)}`);
}
r.ok('case 3: null must not map to paid', provider.mapStatus(null) !== 'paid');

// Case 4 — F31 (launch-weekend) RE-PIN. Ozow's Status enum DOES include Pending and
// PendingInvestigation (six values, not three), and they map to 'pending'. The security-relevant
// half is unchanged: no OTHER input -- in particular no case/whitespace variant -- may map to
// 'pending', so the strictness is preserved, only the two documented spellings are admitted.
const PENDING_RAW_STATUSES = ['Pending', 'PendingInvestigation'];
for (const raw of PENDING_RAW_STATUSES) {
  r.eq(`case 4: '${raw}' maps to 'pending'`, provider.mapStatus(raw), 'pending');
}
const allInputsTried = [
  s.paidInput, ...Object.keys(s.expected), ...s.nonPaidInputs, null,
  'PENDING', 'pending', 'PENDINGINVESTIGATION', 'pendinginvestigation', ' Pending', 'Pending ', 'PendingInvestigation ',
].filter((input) => !PENDING_RAW_STATUSES.includes(input));
for (const input of allInputsTried) {
  r.ok(`case 4: ${JSON.stringify(input)} never maps to 'pending'`, provider.mapStatus(input) !== 'pending', `got ${provider.mapStatus(input)}`);
}

// Case 5 — unrecognised input and null both fall back to 'unknown', not to a settled state.
r.eq('case 5: unrecognised string', provider.mapStatus('SOMETHING-NEW'), s.unknownFallback);
r.eq('case 5: null', provider.mapStatus(null), s.unknownFallback);
r.eq('case 5: empty string', provider.mapStatus(''), s.unknownFallback);

// Case 6 — NON-VACUITY. The mapping actually discriminates.
const distinct = new Set(Object.values(s.expected).concat(s.unknownFallback));
r.ok('case 6: the mapping is not constant', distinct.size >= 4, `${distinct.size} distinct outputs`);

r.done();
