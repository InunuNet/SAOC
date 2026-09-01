#!/usr/bin/env node
// F7 (vendor-registration) -- A15: non-enumerable existence posture. Proves, via real
// handleProofOfPaymentUpload() calls, that an otherwise-identical, rate-limit-clear, validly-
// shaped request produces the EXACT SAME response (status 202, body { accepted: true })
// whether the target submission id exists or not -- an attacker cannot distinguish "this
// submission id is real" from "this submission id is made up" by response shape or status
// code alone. Only the INTERNAL side effects differ: uploadFile/updateSubmission are called
// when the submission exists, and are NEVER called when it does not.
//
// This deliberately trades off a real vendor's own typo going silently unprocessed (no
// distinct error) for closing the enumeration oracle -- the same tradeoff password-reset-style
// "if that account exists, we sent an email" flows make. See golden README "Non-enumerable
// existence posture" for the full justification.
//
// DEFEATING MUTATION: returning 404 (or any status/body distinct from the exists:true case)
// when the submission does not exist.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-nonenumerable-existence.mjs

import { handleProofOfPaymentUpload } from '../../../lib/vendor-proof-of-payment-handler.ts';

const failures = [];
const NOW = new Date('2027-01-05T12:00:00Z');

const VALID_INPUT = {
  submissionId: 'sub-1',
  fileName: 'proof.pdf',
  mimeType: 'application/pdf',
  // sizeBytes must equal the real decoded byte length of fileBase64 below (16 bytes --
  // 'fake-pdf-content') -- see the M2 fix pass, 2026-09-01, that made this the authority
  // (Codex GPT-5.5 finding) in lib/vendor-proof-of-payment-handler.ts.
  sizeBytes: 16,
  fileBase64: 'ZmFrZS1wZGYtY29udGVudA==',
};

function makeDeps(exists) {
  const uploadCalls = [];
  const updateCalls = [];
  return {
    now: NOW,
    rateLimitKey: `vendor-proof-of-payment-ip:${exists ? '203.0.113.1' : '203.0.113.2'}`, // distinct keys -- neither call's rate limiter interferes with the other
    getPriorAttempts: () => [],
    recordAttempt: () => {},
    submissionExists: async () => exists,
    uploadFile: async () => {
      uploadCalls.push(true);
    },
    updateSubmission: async (id, patch) => {
      updateCalls.push({ id, patch });
    },
    _uploadCalls: uploadCalls,
    _updateCalls: updateCalls,
  };
}

const existingDeps = makeDeps(true);
const missingDeps = makeDeps(false);

const existingResult = await handleProofOfPaymentUpload(VALID_INPUT, existingDeps);
const missingResult = await handleProofOfPaymentUpload(VALID_INPUT, missingDeps);

// (1) Status codes must be identical.
if (existingResult.status !== missingResult.status) {
  failures.push(`(1) status differs by existence: existing=${existingResult.status}, missing=${missingResult.status} -- must be identical.`);
}

// (2) Response bodies must be byte-for-byte identical (JSON-serialised comparison).
if (JSON.stringify(existingResult.body) !== JSON.stringify(missingResult.body)) {
  failures.push(
    `(2) response body differs by existence: existing=${JSON.stringify(existingResult.body)}, ` +
      `missing=${JSON.stringify(missingResult.body)} -- must be byte-for-byte identical.`,
  );
}

// (3) Both must be the expected 202/{accepted:true} shape (sanity-check the test itself isn't
// vacuously comparing two error responses).
if (existingResult.status !== 202 || existingResult.body.accepted !== true) {
  failures.push(`(3) expected status 202 with { accepted: true } for the existing-submission case, got status ${existingResult.status}, body ${JSON.stringify(existingResult.body)}.`);
}

// (4) Internal side effects DO differ: upload/update happen only when the submission exists.
if (existingDeps._uploadCalls.length !== 1 || existingDeps._updateCalls.length !== 1) {
  failures.push(`(4) expected exactly one uploadFile/updateSubmission call for an existing submission, got ${existingDeps._uploadCalls.length}/${existingDeps._updateCalls.length}.`);
}
if (missingDeps._uploadCalls.length !== 0 || missingDeps._updateCalls.length !== 0) {
  failures.push(`(4) expected ZERO uploadFile/updateSubmission calls for a missing submission, got ${missingDeps._uploadCalls.length}/${missingDeps._updateCalls.length}.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: handleProofOfPaymentUpload() returns byte-for-byte identical responses (202, ' +
    '{ accepted: true }) whether the target submission exists or not, while only actually ' +
    'calling uploadFile/updateSubmission when it does exist -- the existence of a submission ' +
    'id cannot be enumerated by response shape or status code.',
);
process.exit(0);
