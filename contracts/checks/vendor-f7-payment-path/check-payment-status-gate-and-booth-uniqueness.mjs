#!/usr/bin/env node
// F7 (vendor-registration) -- A5/A6 combined: decideVendorPaymentUpdate()'s two independent
// gates, proven by real function calls. (A5) Office-use payment/booth fields may only be
// recorded against a submission whose currentStatus is 'approved' -- refused from
// 'submitted', 'under-review', and 'rejected'. (A6) A non-empty boothNumber colliding with one
// already allocated to a DIFFERENT approved submission is refused; a non-colliding
// boothNumber, or an omitted/null boothNumber (payment-only update, no booth assigned yet),
// is accepted.
//
// COMBINED-FAILURE CASE: a request that is invalid for BOTH reasons at once (wrong status AND
// a colliding booth number) is tested explicitly below and must still be refused -- the
// function only needs to report one reason (it short-circuits on the status gate first, which
// this test verifies), but each reason is ALSO proven to fail in isolation, so a reviewer can
// see both failure modes are independently real, not just that the combined case happens to
// fail for some unrelated reason.
//
// DEFEATING MUTATION: allowing the status gate to pass for anything other than 'approved'
// (A5), or removing/loosening the booth-uniqueness comparison (A6).
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-payment-status-gate-and-booth-uniqueness.mjs

import { decideVendorPaymentUpdate } from '../../../lib/vendor-payment.ts';

const failures = [];
const NOW = new Date('2027-03-01T09:00:00Z');
const CONFIRMED_BY = 'manager@example.com';

// --- A5: status gate ---

const NON_APPROVED_STATUSES = ['submitted', 'under-review', 'rejected'];
for (const currentStatus of NON_APPROVED_STATUSES) {
  const decision = decideVendorPaymentUpdate({
    currentStatus,
    boothNumber: 'A12',
    paymentReceived: true,
    confirmedBy: CONFIRMED_BY,
    now: NOW,
    allocatedBoothNumbers: [],
  });
  if (decision.ok) {
    failures.push(`(A5) currentStatus '${currentStatus}': expected ok:false (payment/booth fields require 'approved'), got ok:true.`);
  }
}

{
  const decision = decideVendorPaymentUpdate({
    currentStatus: 'approved',
    boothNumber: 'A12',
    paymentReceived: true,
    confirmedBy: CONFIRMED_BY,
    now: NOW,
    allocatedBoothNumbers: [],
  });
  if (!decision.ok) {
    failures.push(`(A5) currentStatus 'approved' with a non-colliding booth number: expected ok:true, got ok:false: ${decision.error}`);
  }
}

// --- A6: booth-number uniqueness ---

{
  // A colliding booth number, against an otherwise-valid 'approved' submission, is refused.
  const decision = decideVendorPaymentUpdate({
    currentStatus: 'approved',
    boothNumber: 'A12',
    paymentReceived: false,
    confirmedBy: CONFIRMED_BY,
    now: NOW,
    allocatedBoothNumbers: ['A12', 'B03'],
  });
  if (decision.ok) {
    failures.push("(A6) a booth number colliding with an already-allocated one was accepted -- expected ok:false.");
  }
}

{
  // A non-colliding booth number is accepted.
  const decision = decideVendorPaymentUpdate({
    currentStatus: 'approved',
    boothNumber: 'C07',
    paymentReceived: false,
    confirmedBy: CONFIRMED_BY,
    now: NOW,
    allocatedBoothNumbers: ['A12', 'B03'],
  });
  if (!decision.ok) {
    failures.push(`(A6) a non-colliding booth number was refused: ${decision.ok ? '' : decision.error}`);
  } else if (decision.patch.boothNumber !== 'C07') {
    failures.push(`(A6) expected patch.boothNumber 'C07', got '${decision.patch.boothNumber}'.`);
  }
}

{
  // Payment-only update: boothNumber omitted entirely -- must not be treated as a collision
  // and must be accepted, with patch.boothNumber normalised to null.
  const decision = decideVendorPaymentUpdate({
    currentStatus: 'approved',
    paymentReceived: true,
    confirmedBy: CONFIRMED_BY,
    now: NOW,
    allocatedBoothNumbers: ['A12', 'B03'],
  });
  if (!decision.ok) {
    failures.push(`(A6) omitting boothNumber entirely was refused: ${decision.error}`);
  } else if (decision.patch.boothNumber !== null) {
    failures.push(`(A6) omitting boothNumber: expected patch.boothNumber null, got '${decision.patch.boothNumber}'.`);
  } else if (decision.patch.paymentReceived !== true) {
    failures.push('(A6) omitting boothNumber: expected patch.paymentReceived true, got a different value.');
  }
}

{
  // Re-confirming the SAME submission's own already-recorded booth number must not be treated
  // as a collision with itself -- the caller is responsible for excluding this submission's own
  // current boothNumber from allocatedBoothNumbers before calling (documented in README); this
  // test proves the function has no special-case self-exclusion logic of its own to break.
  const decision = decideVendorPaymentUpdate({
    currentStatus: 'approved',
    boothNumber: 'C07',
    paymentReceived: true,
    confirmedBy: CONFIRMED_BY,
    now: NOW,
    allocatedBoothNumbers: [], // caller already excluded this submission's own 'C07'
  });
  if (!decision.ok) {
    failures.push(`(A6) re-confirming this submission's own booth number (excluded from allocatedBoothNumbers by the caller) was refused: ${decision.error}`);
  }
}

// --- Combined-failure case: BOTH the status gate AND the booth-uniqueness gate would fail ---

{
  const decision = decideVendorPaymentUpdate({
    currentStatus: 'submitted', // (1) wrong status
    boothNumber: 'A12', // (2) also a colliding booth number
    paymentReceived: true,
    confirmedBy: CONFIRMED_BY,
    now: NOW,
    allocatedBoothNumbers: ['A12'],
  });
  if (decision.ok) {
    failures.push(
      "(combined) currentStatus:'submitted' AND a colliding boothNumber: expected ok:false " +
        "(refused for two independent reasons), got ok:true.",
    );
  } else if (!/status/i.test(decision.error)) {
    failures.push(
      `(combined) expected the reported error to name the status-gate reason (the function ` +
        `short-circuits on it first), got: "${decision.error}"`,
    );
  }
  // Each reason is also proven to fail in isolation above (A5's 'submitted' case; A6's
  // colliding-booth case against an 'approved' status) -- both failure modes are independently
  // real, not merely correlated in this one combined case.
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: decideVendorPaymentUpdate() refuses payment/booth updates against any non-approved ' +
    "status (submitted, under-review, rejected), refuses a booth number colliding with " +
    'allocatedBoothNumbers, accepts a non-colliding or omitted booth number, and refuses a ' +
    'combined wrong-status + colliding-booth request (naming the status-gate reason, with both ' +
    'reasons independently proven to fail on their own).',
);
process.exit(0);
