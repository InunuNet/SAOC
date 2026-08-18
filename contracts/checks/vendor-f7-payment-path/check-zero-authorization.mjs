#!/usr/bin/env node
// F7 (vendor-registration) -- A8: zero-authorization proof, mirroring F4's
// check-zero-authorization.mjs and F6's check-zero-authorization-carrythrough.mjs exactly, for
// lib/vendor-payment.ts.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-zero-authorization.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildVendorSubmission } from '../../../lib/vendor-submissions.ts';
import { decideVendorStatusTransition } from '../../../lib/vendor-review.ts';
import { decideVendorPaymentUpdate, planProofOfPaymentUpload } from '../../../lib/vendor-payment.ts';

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

// (a) A submission carried all the way through review to 'approved', then through a payment
// patch, must still carry no admin/roles/capability-named key when JSON round-tripped.
{
  const built = buildVendorSubmission(MINIMAL, NOW);

  const toUnderReview = decideVendorStatusTransition({
    currentStatus: 'submitted',
    action: 'start-review',
    reviewerEmail: 'manager@example.com',
    now: NOW,
  });
  const toApproved = toUnderReview.ok
    ? decideVendorStatusTransition({
        currentStatus: 'under-review',
        action: 'approve',
        reviewerEmail: 'manager@example.com',
        now: NOW,
      })
    : { ok: false, error: toUnderReview.error };

  if (!toUnderReview.ok || !toApproved.ok) {
    failures.push('(a) setup: could not reach approved status via decideVendorStatusTransition().');
  } else {
    const approved = { ...built, ...toUnderReview.patch, ...toApproved.patch };

    const payment = decideVendorPaymentUpdate({
      currentStatus: approved.status,
      boothNumber: 'A12',
      paymentReceived: true,
      confirmedBy: 'manager@example.com',
      now: NOW,
      allocatedBoothNumbers: [],
    });

    if (!payment.ok) {
      failures.push(`(a) setup: decideVendorPaymentUpdate() unexpectedly refused: ${payment.error}`);
    } else {
      const paid = { ...approved, ...payment.patch };
      const roundTripped = JSON.parse(JSON.stringify(paid));
      const suspiciousKeys = Object.keys(roundTripped).filter((k) => CAPABILITY_KEY_PATTERN.test(k));
      if (suspiciousKeys.length > 0) {
        failures.push(
          `(a) a fully-approved-and-paid VendorSubmission carries authorization-flavoured key(s) ${JSON.stringify(suspiciousKeys)}.`,
        );
      }
      if (roundTripped.boothNumber !== 'A12' || roundTripped.paymentReceived !== true) {
        failures.push('(a) the payment patch did not survive the JSON round trip as expected.');
      }
    }
  }
}

// (b) Static import-graph check: lib/vendor-payment.ts must not import lib/admin-auth.ts or
// lib/admin-roles.ts, by any import path spelling.
{
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(__dirname, '../../../lib/vendor-payment.ts');
  const source = readFileSync(sourcePath, 'utf8');

  const forbiddenImportPattern =
    /from\s+['"](@\/lib\/admin-auth|@\/lib\/admin-roles|\.\.?\/.*admin-auth|\.\.?\/.*admin-roles)['"]/;
  if (forbiddenImportPattern.test(source)) {
    failures.push(
      '(b) lib/vendor-payment.ts imports lib/admin-auth.ts or lib/admin-roles.ts -- this module must not ' +
        'carry or evaluate any authorization meaning; the capability gate belongs only in the route files.',
    );
  }
}

// (c) planProofOfPaymentUpload() itself carries no authorization meaning either -- a valid
// plan for ANY submissionId succeeds identically regardless of that submission's real status,
// since this module has no way to know or check it.
{
  const result = planProofOfPaymentUpload({
    submissionId: 'any-submission-id',
    fileName: 'proof.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  });
  if (!result.ok) {
    failures.push(`(c) planProofOfPaymentUpload() unexpectedly refused a validly-shaped input: ${result.error}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a VendorSubmission carried through review to approved and then through a payment ' +
    'patch carries no admin/roles/capability-flavoured key when JSON round-tripped; ' +
    'lib/vendor-payment.ts imports neither lib/admin-auth.ts nor lib/admin-roles.ts; ' +
    'planProofOfPaymentUpload() has no notion of submission status or authorization at all.',
);
process.exit(0);
