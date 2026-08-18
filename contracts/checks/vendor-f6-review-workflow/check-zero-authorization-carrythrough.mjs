#!/usr/bin/env node
// F6 (vendor-registration) — A7: zero-authorization carry-through, mirroring vendor-f4's
// check-zero-authorization.mjs (a)/(b) exactly, extended to cover the post-review-patch shape.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f6-review-workflow/check-zero-authorization-carrythrough.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildVendorSubmission } from '../../../lib/vendor-submissions.ts';
import { decideVendorStatusTransition } from '../../../lib/vendor-review.ts';

const failures = [];
const NOW = new Date('2027-02-14T09:30:00Z');

const MINIMAL = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

const CAPABILITY_KEY_PATTERN = /^(admin|roles|capabilit)/i;

// (a) A built + reviewed VendorSubmission, serialised through JSON, must carry no
// admin/roles/capability-named key at ANY point in the lifecycle, including after the
// review patch is merged in at 'approved'.
{
  const built = buildVendorSubmission(MINIMAL, NOW);

  const toUnderReview = decideVendorStatusTransition({
    currentStatus: 'submitted',
    action: 'start-review',
    reviewerEmail: 'manager@example.com',
    now: NOW,
  });
  if (!toUnderReview.ok) {
    failures.push(`(a) setup: submitted->under-review unexpectedly refused: ${toUnderReview.error}`);
  } else {
    const underReview = { ...built, ...toUnderReview.patch };

    const toApproved = decideVendorStatusTransition({
      currentStatus: 'under-review',
      action: 'approve',
      reviewerEmail: 'manager@example.com',
      now: NOW,
    });
    if (!toApproved.ok) {
      failures.push(`(a) setup: under-review->approved unexpectedly refused: ${toApproved.error}`);
    } else {
      const approved = { ...underReview, ...toApproved.patch };
      const roundTripped = JSON.parse(JSON.stringify(approved));
      const suspiciousKeys = Object.keys(roundTripped).filter((k) => CAPABILITY_KEY_PATTERN.test(k));
      if (suspiciousKeys.length > 0) {
        failures.push(
          `(a) status:"approved" (post-review patch): VendorSubmission carries authorization-flavoured key(s) ${JSON.stringify(suspiciousKeys)}.`,
        );
      }
      if (roundTripped.status !== 'approved') {
        failures.push(`(a) expected final status 'approved', got '${roundTripped.status}'.`);
      }
    }
  }
}

// (b) Static import-graph check: lib/vendor-review.ts must not import lib/admin-auth.ts or
// lib/admin-roles.ts, by any import path spelling (alias or relative). The transition
// decision is authorization-blind by construction — the capability check lives only in the
// route/layout files (A8 verifies those separately).
{
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(__dirname, '../../../lib/vendor-review.ts');
  const source = readFileSync(sourcePath, 'utf8');

  const forbiddenImportPattern =
    /from\s+['"](@\/lib\/admin-auth|@\/lib\/admin-roles|\.\.?\/.*admin-auth|\.\.?\/.*admin-roles)['"]/;
  if (forbiddenImportPattern.test(source)) {
    failures.push(
      '(b) lib/vendor-review.ts imports lib/admin-auth.ts or lib/admin-roles.ts -- this module must not ' +
        'carry or evaluate any authorization meaning; the capability gate belongs only in the routes/layout.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a VendorSubmission built then carried through both review-patch transitions to ' +
    "'approved' carries no admin/roles/capability-flavoured key when JSON round-tripped, and " +
    'lib/vendor-review.ts imports neither lib/admin-auth.ts nor lib/admin-roles.ts.',
);
process.exit(0);
