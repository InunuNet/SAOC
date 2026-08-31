#!/usr/bin/env node
// vendor-gated-registration-flow M1/F2 — real, executed proof of
// decideVendorApplicationTransition()'s closed status machine (lib/vendor-application-review.ts).
// Mirrors the exact style of the already-shipped lib/vendor-review.ts's own behavioral coverage:
// every legal transition succeeds and returns the expected additive-only patch; every illegal
// transition (including from a terminal state, and skipping straight to approved/declined) is
// refused. No Firestore, no network.
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow/check-application-review-transitions.mjs

import { decideVendorApplicationTransition } from '../../../lib/vendor-application-review.ts';

const failures = [];
const NOW = new Date('2027-02-01T00:00:00Z');
const REVIEWER = 'reviewer@saoc.co.za';

function expectOk(label, input, expectedStatus) {
  const result = decideVendorApplicationTransition(input);
  if (!result.ok) {
    failures.push(`${label}: expected ok:true, got refusal '${result.error}'.`);
    return;
  }
  if (result.patch.status !== expectedStatus) {
    failures.push(`${label}: expected patch.status '${expectedStatus}', got '${result.patch.status}'.`);
  }
  if (result.patch.reviewedBy !== REVIEWER || result.patch.reviewedAt !== NOW) {
    failures.push(`${label}: patch.reviewedBy/reviewedAt were not copied verbatim from the input.`);
  }
  // Additive-only: the patch must be exactly these 3 keys, never a full-document shape that
  // could overwrite submitter-supplied fields via a naive ref.update(patch).
  const keys = Object.keys(result.patch).sort();
  if (keys.join(',') !== 'reviewedAt,reviewedBy,status') {
    failures.push(`${label}: patch had unexpected keys [${keys.join(', ')}] -- expected exactly status/reviewedBy/reviewedAt.`);
  }
}

function expectRefused(label, input) {
  const result = decideVendorApplicationTransition(input);
  if (result.ok) {
    failures.push(`${label}: expected a refusal, but the transition succeeded with patch ${JSON.stringify(result.patch)}.`);
  }
}

// Legal transitions.
expectOk('pending --approve-->approved', { currentStatus: 'pending', action: 'approve', reviewerEmail: REVIEWER, now: NOW }, 'approved');
expectOk('pending --decline-->declined', { currentStatus: 'pending', action: 'decline', reviewerEmail: REVIEWER, now: NOW }, 'declined');

// Illegal: terminal states accept no further action.
expectRefused('approved cannot be re-approved', { currentStatus: 'approved', action: 'approve', reviewerEmail: REVIEWER, now: NOW });
expectRefused('approved cannot be declined', { currentStatus: 'approved', action: 'decline', reviewerEmail: REVIEWER, now: NOW });
expectRefused('declined cannot be approved', { currentStatus: 'declined', action: 'approve', reviewerEmail: REVIEWER, now: NOW });
expectRefused('declined cannot be re-declined', { currentStatus: 'declined', action: 'decline', reviewerEmail: REVIEWER, now: NOW });

// Illegal: an unknown action at a valid status.
expectRefused('unknown action at pending', { currentStatus: 'pending', action: 'start-review', reviewerEmail: REVIEWER, now: NOW });

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: decideVendorApplicationTransition() enforces the closed pending->{approved,declined} ' +
    'machine, refuses every transition from a terminal state, refuses unknown actions, and ' +
    'returns an additive-only 3-key patch with reviewedBy/reviewedAt copied verbatim.',
);
process.exit(0);
