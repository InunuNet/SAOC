#!/usr/bin/env node
// F7 (vendor-registration) -- A14: rate limiting is enforced at the handler level, before
// submissionExists/uploadFile/updateSubmission are ever touched. deps.getPriorAttempts is
// pre-seeded with PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS prior attempts for a given key; an
// otherwise-valid upload against an EXISTING submission under that key must be refused with
// 429 and deps.submissionExists/deps.uploadFile/deps.updateSubmission must all be proven
// called ZERO times. A second call under a DIFFERENT key in the SAME run must succeed
// normally, proving the 429 above wasn't a global failure. Mirrors F5's
// check-rate-limit-shields-write.mjs exactly.
//
// DEFEATING MUTATION: moving the rate-limit check to after the existence check or the upload
// -- the zero-calls assertions on deps.submissionExists/uploadFile/updateSubmission would fail.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-rate-limit-shields-handler-calls.mjs

import { handleProofOfPaymentUpload } from '../../../lib/vendor-proof-of-payment-handler.ts';
import { PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS } from '../../../lib/vendor-payment-rate-limit.ts';

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

function makeDeps(key, priorAttempts, exists = true) {
  const existsCalls = [];
  const uploadCalls = [];
  const updateCalls = [];
  return {
    now: NOW,
    rateLimitKey: key,
    getPriorAttempts: (queriedKey) => (queriedKey === key ? priorAttempts : []),
    recordAttempt: () => {},
    submissionExists: async (id) => {
      existsCalls.push(id);
      return exists;
    },
    uploadFile: async () => {
      uploadCalls.push(true);
    },
    updateSubmission: async (id, patch) => {
      updateCalls.push({ id, patch });
    },
    _existsCalls: existsCalls,
    _uploadCalls: uploadCalls,
    _updateCalls: updateCalls,
  };
}

// (1) A key pre-seeded with exactly MAX_ATTEMPTS prior attempts must be refused with 429
// BEFORE submissionExists/uploadFile/updateSubmission are ever touched, even against a REAL,
// existing submission.
{
  const rateLimitedKey = 'vendor-proof-of-payment-ip:203.0.113.99';
  const priorAttempts = Array.from({ length: PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS }, (_, i) => ({
    key: rateLimitedKey,
    at: new Date(NOW.getTime() - (i + 1) * 60 * 60 * 1000),
  }));
  const deps = makeDeps(rateLimitedKey, priorAttempts, true);

  const result = await handleProofOfPaymentUpload(VALID_INPUT, deps);

  if (result.status !== 429) {
    failures.push(`(1) expected status 429 for a fully rate-limited key, got ${result.status}.`);
  }
  if (deps._existsCalls.length !== 0) {
    failures.push(`(1) deps.submissionExists was called ${deps._existsCalls.length} time(s) on a rate-limited request -- must be zero.`);
  }
  if (deps._uploadCalls.length !== 0) {
    failures.push(`(1) deps.uploadFile was called ${deps._uploadCalls.length} time(s) on a rate-limited request -- must be zero.`);
  }
  if (deps._updateCalls.length !== 0) {
    failures.push(`(1) deps.updateSubmission was called ${deps._updateCalls.length} time(s) on a rate-limited request -- must be zero.`);
  }
}

// (2) A DIFFERENT key with no prior attempts and the same valid input must succeed normally in
// the SAME run.
{
  const freshKey = 'vendor-proof-of-payment-ip:198.51.100.42';
  const deps = makeDeps(freshKey, [], true);

  const result = await handleProofOfPaymentUpload(VALID_INPUT, deps);

  if (result.status !== 202) {
    failures.push(`(2) expected status 202 for a fresh, unrate-limited key against an existing submission, got ${result.status}.`);
  }
  if (deps._uploadCalls.length !== 1 || deps._updateCalls.length !== 1) {
    failures.push(`(2) expected exactly one uploadFile/updateSubmission call, got ${deps._uploadCalls.length}/${deps._updateCalls.length}.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a key pre-seeded with PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS prior attempts is ' +
    'refused with 429 before submissionExists/uploadFile/updateSubmission are ever called, ' +
    'while a different, unrate-limited key succeeds normally in the same run.',
);
process.exit(0);
