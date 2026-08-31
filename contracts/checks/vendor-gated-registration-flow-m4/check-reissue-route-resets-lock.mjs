#!/usr/bin/env node
// vendor-gated-registration-flow M4/F25 -- structural proof for
// app/api/admin/vendors/applications/[id]/reissue-code/route.ts. Same class of limitation as
// the retired A20/the new A50's Part 1: exercising the real route needs a Firebase Admin
// credential and an authenticated admin session cookie, neither available in this environment
// (see contracts/checks/ozow-sandbox-toggle-f1/check-public-status-route-fails-closed.mjs for
// this project's established precedent for gating routes checked this way). What IS
// mechanically checkable and hard to satisfy by accident:
//
//   1. The SAME capability gate as the existing review route -- getAdminSession() then
//      hasCapability(..., 'review-vendor-applications', ...) -- no new/weaker capability.
//   2. Callable any time status === 'approved', NOT additionally conditioned on
//      registrationCodeLockedAt being set (the golden's "Reissue, not unlock" -- one action
//      covers both "locked out" and "lost the email").
//   3. A single ref.update() patch (never a full-document overwrite) that both resets
//      registrationCodeFailedAttempts to 0 / registrationCodeLockedAt to null AND writes a
//      FRESH registrationCodeId from a real call to generateVendorRegistrationCodeId() (not a
//      reuse of the existing stored value).
//   4. M4 fix pass (architect pass 4, 2026-09-01, team-lead item 3): the SAME patch increments
//      registrationCodeGeneration. Without this, reissuing a code mints a new code but does NOT
//      revoke a session already minted from the OLD one -- that session's signed payload still
//      carries the stale generation, and lib/vendor-registration-token-claim.ts's
//      expectedGeneration check (see the strengthened check-single-use-claim-is-atomic.mjs) is
//      what actually rejects it, but only if this route bumped the counter in the first place.
//      This is the line that makes "reissue" an actual revocation, not just a second valid code.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m4/check-reissue-route-resets-lock.mjs

import { readFileSync } from 'node:fs';

const ROUTE = 'app/api/admin/vendors/applications/[id]/reissue-code/route.ts';
const failures = [];

let raw;
try {
  raw = readFileSync(new URL(`../../../${ROUTE}`, import.meta.url), 'utf8');
} catch {
  failures.push(`${ROUTE} does not exist.`);
  console.error(`FAIL: ${failures[0]}`);
  process.exit(1);
}

const source = raw
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

// 1. Same capability gate as the existing review route.
if (!/getAdminSession\s*\(/.test(source)) {
  failures.push(`${ROUTE}: no getAdminSession() call -- route is not admin-gated.`);
}
if (!/hasCapability\([^)]*'review-vendor-applications'/.test(source)) {
  failures.push(`${ROUTE}: does not gate on the 'review-vendor-applications' capability (same one the review route uses).`);
}

// 2. Callable regardless of lock state -- must precondition on status === 'approved' but must
//    NOT also require registrationCodeLockedAt to be truthy before proceeding.
if (!/status\s*!==\s*'approved'/.test(source) && !/status\s*===\s*'approved'/.test(source)) {
  failures.push(`${ROUTE}: no status === 'approved' precondition found.`);
}
if (/registrationCodeLockedAt[\s\S]{0,80}(&&|return|if\s*\()/.test(source) && /if\s*\([^)]*registrationCodeLockedAt/.test(source)) {
  failures.push(`${ROUTE}: gated on registrationCodeLockedAt -- reissue must be available any time an application is approved, not only when locked.`);
}

// 3. A single additive ref.update() patch resetting counters and writing a FRESH code.
const updateCalls = [...source.matchAll(/ref\.update\(/g)].map((m) => m.index);
if (updateCalls.length === 0) {
  failures.push(`${ROUTE}: no ref.update(...) call found.`);
} else if (updateCalls.length > 1) {
  failures.push(`${ROUTE}: found ${updateCalls.length} ref.update() call sites -- the reset must be a single additive patch.`);
} else {
  const afterUpdate = source.slice(updateCalls[0]);
  const closeAt = afterUpdate.indexOf('\n  }');
  const updateArgs = afterUpdate.slice(0, closeAt === -1 ? undefined : closeAt);
  for (const [field, expected] of [
    ['registrationCodeFailedAttempts', /registrationCodeFailedAttempts\s*:\s*0/],
    ['registrationCodeLockedAt', /registrationCodeLockedAt\s*:\s*null/],
    ['registrationCodeId', /registrationCodeId\s*[,:]/],
    // Team-lead item 3 -- without this, reissue mints a new code but never revokes a session
    // already minted from the old one. Requires an actual INCREMENT (FieldValue.increment(...)
    // or a functionally equivalent `+ 1`), not merely the field name appearing (which would be
    // satisfied even by an accidental reset to a fixed value).
    ['registrationCodeGeneration (incremented)', /registrationCodeGeneration\s*:\s*[\w.]*(?:increment\(|FieldValue\.increment\(|\+\s*1\b)/],
  ]) {
    if (!expected.test(updateArgs)) {
      failures.push(`${ROUTE}: the update patch does not reset/write ${field} as expected (${expected}).`);
    }
  }
}

if (/ref\.set\(/.test(source) && !/ref\.set\([^)]*\{\s*merge:\s*true/.test(source)) {
  failures.push(`${ROUTE}: contains a ref.set() without { merge: true } -- risks a full-document overwrite.`);
}

// A fresh code -- generateVendorRegistrationCodeId() must actually be called in this route, not
// a reuse/read of the existing stored registrationCodeId.
if (!/generateVendorRegistrationCodeId\s*\(\s*\)/.test(source)) {
  failures.push(`${ROUTE}: does not call generateVendorRegistrationCodeId() -- the reissued code may not be freshly generated.`);
}
if (!/normalizeVendorCodeName\s*\(/.test(source)) {
  failures.push(`${ROUTE}: does not call normalizeVendorCodeName() -- registrationCodeNameSlug may go stale if businessName changed since approval.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the reissue-code route is gated by the same review-vendor-applications capability, is ' +
    'callable any time an application is approved (not conditioned on being locked), and applies ' +
    'a single additive patch that resets the failed-attempt counter and lock, writes a freshly ' +
    'generated code, and increments registrationCodeGeneration -- the line that makes reissue an ' +
    'actual revocation of any session minted from the prior code.',
);
process.exit(0);
