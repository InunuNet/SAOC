#!/usr/bin/env node
// F7 (vendor-registration) -- A7: additive-patch and injected-time proof, mirroring F6's
// check-additive-patch-injected-time.mjs (itself mirroring F8's compedBy/purchasedAt pattern).
// Proves, via real decideVendorPaymentUpdate() calls:
//   1. Every successful patch has EXACTLY the 4 keys {boothNumber, paymentReceived,
//      paymentConfirmedBy, paymentConfirmedAt}.
//   2. paymentConfirmedBy is the exact injected confirmedBy, not a placeholder.
//   3. paymentConfirmedAt derives exclusively from the injected `now` -- never Date.now()
//      internally.
//   4. Every refused decision has EXACTLY the 2 keys {ok, error} -- no stray `patch`.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-additive-patch-injected-time.mjs

import { decideVendorPaymentUpdate } from '../../../lib/vendor-payment.ts';

const failures = [];
const EXPECTED_PATCH_KEYS = ['boothNumber', 'paymentReceived', 'paymentConfirmedBy', 'paymentConfirmedAt'].sort();

const baseInput = (overrides = {}) => ({
  currentStatus: 'approved',
  boothNumber: 'A12',
  paymentReceived: true,
  confirmedBy: 'manager@example.com',
  now: new Date('2027-03-01T09:00:00Z'),
  allocatedBoothNumbers: [],
  ...overrides,
});

// (1) Additive-only patch shape.
{
  const decision = decideVendorPaymentUpdate(baseInput());
  if (!decision.ok) {
    failures.push(`(1) expected ok:true, got ok:false: ${decision.error}`);
  } else {
    const keys = Object.keys(decision.patch).sort();
    if (JSON.stringify(keys) !== JSON.stringify(EXPECTED_PATCH_KEYS)) {
      failures.push(`(1) patch keys were ${JSON.stringify(keys)}, expected exactly ${JSON.stringify(EXPECTED_PATCH_KEYS)}.`);
    }
    const decisionKeys = Object.keys(decision).sort();
    if (JSON.stringify(decisionKeys) !== JSON.stringify(['ok', 'patch'])) {
      failures.push(`(1) decision object keys were ${JSON.stringify(decisionKeys)}, expected exactly ["ok","patch"].`);
    }
  }
}

// (2) paymentConfirmedBy is the exact injected confirmedBy -- two different admins produce two
// different values, never a constant/placeholder.
{
  const a = decideVendorPaymentUpdate(baseInput({ confirmedBy: 'alice@example.com' }));
  const b = decideVendorPaymentUpdate(baseInput({ confirmedBy: 'bob@example.com' }));
  if (!a.ok || a.patch.paymentConfirmedBy !== 'alice@example.com') {
    failures.push(`(2a) expected paymentConfirmedBy 'alice@example.com', got ${a.ok ? a.patch.paymentConfirmedBy : `ok:false (${a.error})`}.`);
  }
  if (!b.ok || b.patch.paymentConfirmedBy !== 'bob@example.com') {
    failures.push(`(2b) expected paymentConfirmedBy 'bob@example.com', got ${b.ok ? b.patch.paymentConfirmedBy : `ok:false (${b.error})`}.`);
  }
}

// (3) paymentConfirmedAt derives exclusively from the injected `now`. Two calls with an
// IDENTICAL explicit `now`, several ms apart in real wall-clock time, produce IDENTICAL
// paymentConfirmedAt.
{
  const fixedNow = new Date('2027-06-01T12:00:00.000Z');
  const first = decideVendorPaymentUpdate(baseInput({ now: fixedNow }));
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = decideVendorPaymentUpdate(baseInput({ now: fixedNow }));

  const firstMs = first.ok ? first.patch.paymentConfirmedAt?.getTime?.() : null;
  const secondMs = second.ok ? second.patch.paymentConfirmedAt?.getTime?.() : null;

  if (firstMs === null || secondMs === null) {
    failures.push('(3) paymentConfirmedAt was not a Date with getTime() on one or both calls.');
  } else {
    if (firstMs !== fixedNow.getTime()) {
      failures.push(`(3) paymentConfirmedAt.getTime() was ${firstMs}, expected exactly ${fixedNow.getTime()} (the injected 'now').`);
    }
    if (firstMs !== secondMs) {
      failures.push(
        `(3) Two calls with the IDENTICAL explicit 'now' produced different paymentConfirmedAt values ` +
          `(${firstMs} vs ${secondMs}) -- the function is reading wall-clock time internally instead of ` +
          "using the supplied 'now'.",
      );
    }
  }
}

// (4) A different `now` produces a correspondingly different paymentConfirmedAt.
{
  const nowA = new Date('2027-01-01T00:00:00.000Z');
  const nowB = new Date('2027-12-31T23:59:59.000Z');
  const a = decideVendorPaymentUpdate(baseInput({ now: nowA }));
  const b = decideVendorPaymentUpdate(baseInput({ now: nowB }));
  if (a.ok && b.ok && a.patch.paymentConfirmedAt.getTime() === b.patch.paymentConfirmedAt.getTime()) {
    failures.push('(4) Two calls with genuinely different `now` values produced the same paymentConfirmedAt -- expected them to differ.');
  }
}

// (5) Every refused decision has EXACTLY the 2 keys {ok, error} -- no stray `patch`.
const REFUSED_CASES = [
  baseInput({ currentStatus: 'submitted' }),
  baseInput({ currentStatus: 'under-review' }),
  baseInput({ currentStatus: 'rejected' }),
  baseInput({ boothNumber: 'A12', allocatedBoothNumbers: ['A12'] }),
];
for (const input of REFUSED_CASES) {
  const decision = decideVendorPaymentUpdate(input);
  if (decision.ok) {
    failures.push(`(5) input ${JSON.stringify(input)}: expected ok:false, got ok:true.`);
    continue;
  }
  const keys = Object.keys(decision).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['error', 'ok'])) {
    failures.push(`(5) refusal object keys were ${JSON.stringify(keys)}, expected exactly ["error","ok"].`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: every successful patch carries exactly {boothNumber, paymentReceived, ' +
    'paymentConfirmedBy, paymentConfirmedAt}; paymentConfirmedBy is the exact injected admin ' +
    "email; paymentConfirmedAt derives exclusively from the injected 'now' (proven by " +
    'identical-now/different-now pairs, never Date.now() internally); every refused decision ' +
    'carries exactly {ok, error} with no stray patch.',
);
process.exit(0);
