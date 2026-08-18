#!/usr/bin/env node
// F6 (vendor-registration) — A5: the closed status-transition machine, proven by real
// decideVendorStatusTransition() calls over ALL 12 (currentStatus, action) combinations
// (4 statuses x 3 actions), not just the 3 valid paths. Exactly 3 combinations must succeed;
// every other 9 — including a direct submitted->approved/rejected shortcut and any action at
// all from a terminal state (approved/rejected) — must be refused.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f6-review-workflow/check-closed-transition-machine.mjs

import { decideVendorStatusTransition } from '../../../lib/vendor-review.ts';

const STATUSES = ['submitted', 'under-review', 'approved', 'rejected'];
const ACTIONS = ['start-review', 'approve', 'reject'];
const NOW = new Date('2027-03-01T09:00:00Z');
const REVIEWER = 'manager@example.com';

// The ONLY 3 combinations that should succeed, and their expected next status.
const ALLOWED = new Map([
  ['submitted:start-review', 'under-review'],
  ['under-review:approve', 'approved'],
  ['under-review:reject', 'rejected'],
]);

const failures = [];

for (const currentStatus of STATUSES) {
  for (const action of ACTIONS) {
    const key = `${currentStatus}:${action}`;
    const decision = decideVendorStatusTransition({ currentStatus, action, reviewerEmail: REVIEWER, now: NOW });
    const shouldSucceed = ALLOWED.has(key);

    if (shouldSucceed) {
      const expectedNext = ALLOWED.get(key);
      if (!decision.ok) {
        failures.push(`(${key}) expected ok:true (next status '${expectedNext}'), got ok:false: ${decision.error}`);
      } else if (decision.patch.status !== expectedNext) {
        failures.push(`(${key}) expected next status '${expectedNext}', got '${decision.patch.status}'.`);
      }
    } else {
      if (decision.ok) {
        failures.push(
          `(${key}) expected ok:false (this transition must be refused), got ok:true with patch ${JSON.stringify(decision.patch)}.`,
        );
      } else if (typeof decision.error !== 'string' || decision.error.length === 0) {
        failures.push(`(${key}) refusal has no non-empty 'error' string.`);
      }
    }
  }
}

// Explicit call-outs for the two most security-relevant refusals, named individually so a
// reader doesn't have to reconstruct them from the matrix above.
{
  const shortcut = decideVendorStatusTransition({
    currentStatus: 'submitted',
    action: 'approve',
    reviewerEmail: REVIEWER,
    now: NOW,
  });
  if (shortcut.ok) {
    failures.push("(shortcut) 'submitted' + 'approve' must be refused — approval must pass through 'under-review' first.");
  }
}
{
  const terminalReopen = decideVendorStatusTransition({
    currentStatus: 'approved',
    action: 'start-review',
    reviewerEmail: REVIEWER,
    now: NOW,
  });
  if (terminalReopen.ok) {
    failures.push("(terminal) 'approved' + 'start-review' must be refused — no transition out of a terminal state.");
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: decideVendorStatusTransition() permits exactly the 3 intended edges ' +
    '(submitted->under-review, under-review->approved, under-review->rejected) across all ' +
    '12 (status, action) combinations, and refuses all 9 others, including the ' +
    'submitted->approved shortcut and every transition out of a terminal state.',
);
process.exit(0);
