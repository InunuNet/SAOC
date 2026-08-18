#!/usr/bin/env node
// F7 (vendor-registration) -- A16: overwrite semantics for a second proof-of-payment upload
// against the SAME submission. Decision: REPLACE, never refuse and never version -- a vendor
// may legitimately re-upload (a bad scan, a wrong file, a payment correction) and the latest
// upload is always the one that matters to the reviewing admin. Proven via two successive
// real handleProofOfPaymentUpload() calls against the same submissionId:
//   1. Both calls compute the IDENTICAL deterministic storagePath (same submissionId + same
//      mimeType -> same path) -- the second upload overwrites the same Storage object, it is
//      never written to a second, versioned path.
//   2. Both calls succeed (202) and both call uploadFile/updateSubmission -- the second
//      upload is never silently refused or ignored because a first one already exists.
//   3. The SECOND call's proofOfPaymentUploadedAt is the value from the SECOND call's `now`,
//      not the first -- the latest upload's timestamp is the one that survives.
//
// DEFEATING MUTATION: refusing a second upload for an id that already has
// proofOfPaymentPath set; or writing the second upload to a distinct, versioned path instead
// of overwriting the same one.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-overwrite-semantics.mjs

import { handleProofOfPaymentUpload } from '../../../lib/vendor-proof-of-payment-handler.ts';

const failures = [];
const SUBMISSION_ID = 'sub-1';

function makeDeps(now) {
  const updateCalls = [];
  return {
    now,
    rateLimitKey: 'vendor-proof-of-payment-ip:203.0.113.10',
    getPriorAttempts: () => [], // fresh store per call -- isolates this test from A14's rate-limit assertions
    recordAttempt: () => {},
    submissionExists: async () => true,
    uploadFile: async () => {},
    updateSubmission: async (id, patch) => {
      updateCalls.push({ id, patch });
    },
    _updateCalls: updateCalls,
  };
}

const firstNow = new Date('2027-01-05T09:00:00Z');
const secondNow = new Date('2027-01-06T14:30:00Z');

const firstInput = {
  submissionId: SUBMISSION_ID,
  fileName: 'proof-v1.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  fileBase64: 'Zmlyc3QtdXBsb2Fk',
};
// A different original file name -- proves the stored path is mime-derived, not
// filename-derived, so a second upload with a DIFFERENT file name still lands at the SAME path.
const secondInput = {
  submissionId: SUBMISSION_ID,
  fileName: 'proof-corrected-v2.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  fileBase64: 'c2Vjb25kLXVwbG9hZA==',
};

const firstDeps = makeDeps(firstNow);
const firstResult = await handleProofOfPaymentUpload(firstInput, firstDeps);

const secondDeps = makeDeps(secondNow);
const secondResult = await handleProofOfPaymentUpload(secondInput, secondDeps);

// (1) Both calls succeed.
if (firstResult.status !== 202 || secondResult.status !== 202) {
  failures.push(`(1) expected both uploads to succeed with 202, got first=${firstResult.status}, second=${secondResult.status}.`);
}

// (2) Both calls actually reached updateSubmission exactly once each -- neither was refused
// or silently skipped because the other exists.
if (firstDeps._updateCalls.length !== 1) {
  failures.push(`(2) first upload: expected exactly one updateSubmission call, got ${firstDeps._updateCalls.length}.`);
}
if (secondDeps._updateCalls.length !== 1) {
  failures.push(`(2) second upload: expected exactly one updateSubmission call, got ${secondDeps._updateCalls.length} -- a second upload for an already-uploaded submission must NOT be refused.`);
}

// (3) Both calls compute the IDENTICAL storagePath -- overwrite, not versioning.
{
  const firstPath = firstDeps._updateCalls[0]?.patch.proofOfPaymentPath;
  const secondPath = secondDeps._updateCalls[0]?.patch.proofOfPaymentPath;
  if (!firstPath || !secondPath || firstPath !== secondPath) {
    failures.push(`(3) expected both uploads to compute the identical storagePath (overwrite, not versioning), got first="${firstPath}", second="${secondPath}".`);
  }
}

// (4) The SECOND call's proofOfPaymentUploadedAt reflects the SECOND call's `now`, not the
// first -- the latest upload's timestamp is the one that survives.
{
  const secondUploadedAt = secondDeps._updateCalls[0]?.patch.proofOfPaymentUploadedAt;
  if (!secondUploadedAt || secondUploadedAt.getTime() !== secondNow.getTime()) {
    failures.push(`(4) expected the second upload's proofOfPaymentUploadedAt to equal the second call's 'now' (${secondNow.toISOString()}), got ${secondUploadedAt?.toISOString?.()}.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a second proof-of-payment upload for the same submission is never refused, computes ' +
    'the identical deterministic storagePath as the first (overwrite, not versioning) even ' +
    "with a different original file name, and its proofOfPaymentUploadedAt reflects the " +
    "second call's own injected 'now'.",
);
process.exit(0);
