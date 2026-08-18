#!/usr/bin/env node
// F6 (vendor-registration) — A6: additive-patch and injected-time proof, mirroring F8's
// compedBy/purchasedAt pattern (contracts/checks/ticketing-f8-comp-tickets/
// check-attribution-injected-time.mjs). Proves, via real decideVendorStatusTransition() calls:
//   1. Every successful patch has EXACTLY the 3 keys {status, reviewedBy, reviewedAt}.
//   2. reviewedBy is the exact injected reviewerEmail, not a placeholder.
//   3. reviewedAt derives exclusively from the injected `now` — never Date.now() internally.
//   4. Every refused decision has EXACTLY the 2 keys {ok, error} — no stray `patch`.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f6-review-workflow/check-additive-patch-injected-time.mjs

import { decideVendorStatusTransition } from '../../../lib/vendor-review.ts';

const failures = [];
const EXPECTED_PATCH_KEYS = ['status', 'reviewedBy', 'reviewedAt'].sort();

const VALID_CASES = [
  { currentStatus: 'submitted', action: 'start-review' },
  { currentStatus: 'under-review', action: 'approve' },
  { currentStatus: 'under-review', action: 'reject' },
];

// (1) Additive-only patch shape across all 3 valid transitions.
for (const { currentStatus, action } of VALID_CASES) {
  const decision = decideVendorStatusTransition({
    currentStatus,
    action,
    reviewerEmail: 'manager@example.com',
    now: new Date('2027-03-01T09:00:00Z'),
  });
  if (!decision.ok) {
    failures.push(`(1) ${currentStatus}+${action}: expected ok:true, got ok:false: ${decision.error}`);
    continue;
  }
  const keys = Object.keys(decision.patch).sort();
  if (JSON.stringify(keys) !== JSON.stringify(EXPECTED_PATCH_KEYS)) {
    failures.push(
      `(1) ${currentStatus}+${action}: patch keys were ${JSON.stringify(keys)}, expected exactly ${JSON.stringify(EXPECTED_PATCH_KEYS)}.`,
    );
  }
  const decisionKeys = Object.keys(decision).sort();
  if (JSON.stringify(decisionKeys) !== JSON.stringify(['ok', 'patch'])) {
    failures.push(`(1) ${currentStatus}+${action}: decision object keys were ${JSON.stringify(decisionKeys)}, expected exactly ["ok","patch"].`);
  }
}

// (2) reviewedBy is the exact injected reviewerEmail — two different reviewers produce two
// different values, never a constant/placeholder.
{
  const now = new Date('2027-03-01T09:00:00Z');
  const a = decideVendorStatusTransition({ currentStatus: 'submitted', action: 'start-review', reviewerEmail: 'alice@example.com', now });
  const b = decideVendorStatusTransition({ currentStatus: 'submitted', action: 'start-review', reviewerEmail: 'bob@example.com', now });
  if (!a.ok || a.patch.reviewedBy !== 'alice@example.com') {
    failures.push(`(2a) expected reviewedBy 'alice@example.com', got ${a.ok ? a.patch.reviewedBy : `ok:false (${a.error})`}.`);
  }
  if (!b.ok || b.patch.reviewedBy !== 'bob@example.com') {
    failures.push(`(2b) expected reviewedBy 'bob@example.com', got ${b.ok ? b.patch.reviewedBy : `ok:false (${b.error})`}.`);
  }
}

// (3) reviewedAt derives exclusively from the injected `now`. Two calls with an IDENTICAL
// explicit `now`, several ms apart in real wall-clock time, must produce IDENTICAL reviewedAt.
{
  const fixedNow = new Date('2027-06-01T12:00:00.000Z');
  const first = decideVendorStatusTransition({ currentStatus: 'submitted', action: 'start-review', reviewerEmail: 'manager@example.com', now: fixedNow });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = decideVendorStatusTransition({ currentStatus: 'submitted', action: 'start-review', reviewerEmail: 'manager@example.com', now: fixedNow });

  const firstMs = first.ok ? first.patch.reviewedAt?.getTime?.() : null;
  const secondMs = second.ok ? second.patch.reviewedAt?.getTime?.() : null;

  if (firstMs === null || secondMs === null) {
    failures.push('(3) reviewedAt was not a Date with getTime() on one or both calls.');
  } else {
    if (firstMs !== fixedNow.getTime()) {
      failures.push(`(3) reviewedAt.getTime() was ${firstMs}, expected exactly ${fixedNow.getTime()} (the injected 'now').`);
    }
    if (firstMs !== secondMs) {
      failures.push(
        `(3) Two calls with the IDENTICAL explicit 'now' produced different reviewedAt values (${firstMs} vs ${secondMs}) — ` +
          "the function is reading wall-clock time internally instead of using the supplied 'now'.",
      );
    }
  }
}

// (4) A different `now` produces a correspondingly different reviewedAt — proving (3)'s
// equality isn't because the function ignores `now` entirely and always returns some constant.
{
  const nowA = new Date('2027-01-01T00:00:00.000Z');
  const nowB = new Date('2027-12-31T23:59:59.000Z');
  const a = decideVendorStatusTransition({ currentStatus: 'submitted', action: 'start-review', reviewerEmail: 'manager@example.com', now: nowA });
  const b = decideVendorStatusTransition({ currentStatus: 'submitted', action: 'start-review', reviewerEmail: 'manager@example.com', now: nowB });
  if (a.ok && b.ok && a.patch.reviewedAt.getTime() === b.patch.reviewedAt.getTime()) {
    failures.push('(4) Two calls with genuinely different `now` values produced the same reviewedAt — expected them to differ.');
  }
}

// (5) Every refused decision has EXACTLY the 2 keys {ok, error} — no stray `patch`.
const REFUSED_CASES = [
  { currentStatus: 'submitted', action: 'approve' },
  { currentStatus: 'approved', action: 'approve' },
  { currentStatus: 'rejected', action: 'reject' },
];
for (const { currentStatus, action } of REFUSED_CASES) {
  const decision = decideVendorStatusTransition({
    currentStatus,
    action,
    reviewerEmail: 'manager@example.com',
    now: new Date('2027-03-01T09:00:00Z'),
  });
  if (decision.ok) {
    failures.push(`(5) ${currentStatus}+${action}: expected ok:false, got ok:true.`);
    continue;
  }
  const keys = Object.keys(decision).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['error', 'ok'])) {
    failures.push(`(5) ${currentStatus}+${action}: refusal object keys were ${JSON.stringify(keys)}, expected exactly ["error","ok"].`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: every successful patch carries exactly {status, reviewedBy, reviewedAt}; reviewedBy ' +
    'is the exact injected reviewer email; reviewedAt derives exclusively from the injected ' +
    "'now' (proven by identical-now/different-now pairs, never Date.now() internally); every " +
    'refused decision carries exactly {ok, error} with no stray patch.',
);
process.exit(0);
