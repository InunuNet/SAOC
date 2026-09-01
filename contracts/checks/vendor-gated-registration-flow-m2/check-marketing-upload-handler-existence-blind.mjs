#!/usr/bin/env node
// F18 (vendor-gated-registration-flow, M2) -- A34: POST /api/vendors/[id]/marketing-asset is
// rate-limited before any Firestore/Storage call and returns a byte-identical response whether
// or not the submission id exists -- same non-enumerable-existence + rate-limit-shields-
// everything techniques as F7's own check-nonenumerable-existence.mjs and
// check-rate-limit-shields-handler-calls.mjs, run against lib/vendor-marketing-upload-
// handler.ts directly.
//
// MODULE/INTERFACE SPEC (flagged, not guessed silently -- mirrors F7's
// lib/vendor-proof-of-payment-handler.ts shape exactly, since the M2 golden README does not
// name this module's exports):
//   lib/vendor-marketing-upload-handler.ts exports
//     handleMarketingAssetUpload(input: { submissionId, assetSlot, fileName, mimeType,
//       sizeBytes, fileBase64 }, deps): Promise<{ status, body }>, where deps supplies
//       { now, rateLimitKey, getPriorAttempts, recordAttempt, submissionExists, uploadFile,
//       updateSubmission } -- fully injectable, no Firebase Admin SDK/Storage import, mirroring
//       F7's handleProofOfPaymentUpload() deps shape. A successful upload responds 202 with
//       body { accepted: true }, identical to F7's own response shape.
//
// PENDING: F18 is not implemented yet -- this check imports the real module via a try/caught
// dynamic import so a missing module fails with ONE clear line, never a raw Node stack trace.
//
// FAILS ON: the rate-limit check happening after any I/O (submissionExists/uploadFile/
// updateSubmission called on a rate-limited request), the 202 response body/status differing
// between an existing and a non-existent submission id, OR (today) the module not existing
// yet -- both are real, property-shaped failures, never a false pass.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m2/check-marketing-upload-handler-existence-blind.mjs

const MODULE_PATH = '../../../lib/vendor-marketing-upload-handler.ts';

let mod;
try {
  mod = await import(MODULE_PATH);
} catch (err) {
  console.error(
    'FAIL: lib/vendor-marketing-upload-handler.ts does not exist or fails to load yet -- F18 ' +
      '(vendor-gated-registration-flow, M2) is not implemented. This check will start ' +
      'exercising real rate-limit and existence-blindness behaviour once the module exports ' +
      "handleMarketingAssetUpload() per this file's own header comment. Underlying error: " +
      `${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

const { handleMarketingAssetUpload } = mod;
const failures = [];

if (typeof handleMarketingAssetUpload !== 'function') {
  failures.push('lib/vendor-marketing-upload-handler.ts does not export a handleMarketingAssetUpload function.');
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

const NOW = new Date('2027-01-05T12:00:00Z');
const VALID_INPUT = {
  submissionId: 'sub-1',
  assetSlot: 'logo',
  fileName: 'logo.png',
  mimeType: 'image/png',
  // sizeBytes must equal the real decoded byte length of fileBase64 below (16 bytes --
  // 'fake-png-content') -- see the M2 fix pass, 2026-09-01, that made this the authority
  // (Codex GPT-5.5 finding) in lib/vendor-marketing-upload-handler.ts.
  sizeBytes: 16,
  fileBase64: 'ZmFrZS1wbmctY29udGVudA==',
};

function makeDeps({ key, exists, priorAttempts = [] }) {
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

// --- (1) non-enumerable existence: byte-identical response whether the submission exists or
// not, but internal side effects (uploadFile/updateSubmission) only fire when it does. ---
{
  const existingDeps = makeDeps({ key: 'vendor-marketing-ip:203.0.113.1', exists: true });
  const missingDeps = makeDeps({ key: 'vendor-marketing-ip:203.0.113.2', exists: false });

  const existingResult = await handleMarketingAssetUpload(VALID_INPUT, existingDeps);
  const missingResult = await handleMarketingAssetUpload(VALID_INPUT, missingDeps);

  if (existingResult.status !== missingResult.status) {
    failures.push(`(1) status differs by existence: existing=${existingResult.status}, missing=${missingResult.status} -- must be identical.`);
  }
  if (JSON.stringify(existingResult.body) !== JSON.stringify(missingResult.body)) {
    failures.push(
      `(1) response body differs by existence: existing=${JSON.stringify(existingResult.body)}, ` +
        `missing=${JSON.stringify(missingResult.body)} -- must be byte-for-byte identical.`,
    );
  }
  if (existingResult.status !== 202 || existingResult.body.accepted !== true) {
    failures.push(`(1) expected status 202 with { accepted: true } for the existing-submission case, got status ${existingResult.status}, body ${JSON.stringify(existingResult.body)}.`);
  }
  if (existingDeps._uploadCalls.length !== 1 || existingDeps._updateCalls.length !== 1) {
    failures.push(`(1) expected exactly one uploadFile/updateSubmission call for an existing submission, got ${existingDeps._uploadCalls.length}/${existingDeps._updateCalls.length}.`);
  }
  if (missingDeps._uploadCalls.length !== 0 || missingDeps._updateCalls.length !== 0) {
    failures.push(`(1) expected ZERO uploadFile/updateSubmission calls for a missing submission, got ${missingDeps._uploadCalls.length}/${missingDeps._updateCalls.length}.`);
  }
}

// --- (2) rate limiting happens before any I/O, even against a real, existing submission. ---
{
  const MAX_ATTEMPTS_GUESS = 20; // deliberately large -- any reasonable rate limiter's ceiling
  const rateLimitedKey = 'vendor-marketing-ip:203.0.113.99';
  const priorAttempts = Array.from({ length: MAX_ATTEMPTS_GUESS }, (_, i) => ({
    key: rateLimitedKey,
    at: new Date(NOW.getTime() - (i + 1) * 60 * 1000),
  }));
  const deps = makeDeps({ key: rateLimitedKey, exists: true, priorAttempts });

  const result = await handleMarketingAssetUpload(VALID_INPUT, deps);

  if (result.status !== 429) {
    failures.push(
      `(2) expected status 429 for a key pre-seeded with ${MAX_ATTEMPTS_GUESS} prior attempts, ` +
        `got ${result.status} -- if the real rate limit ceiling is higher than ` +
        `${MAX_ATTEMPTS_GUESS}, raise MAX_ATTEMPTS_GUESS to match the real exported constant ` +
        'this check should import instead of guessing (mirrors F7\'s own ' +
        'PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS import once the equivalent constant exists).',
    );
  }
  if (deps._existsCalls.length !== 0) {
    failures.push(`(2) deps.submissionExists was called ${deps._existsCalls.length} time(s) on a rate-limited request -- must be zero.`);
  }
  if (deps._uploadCalls.length !== 0) {
    failures.push(`(2) deps.uploadFile was called ${deps._uploadCalls.length} time(s) on a rate-limited request -- must be zero.`);
  }
  if (deps._updateCalls.length !== 0) {
    failures.push(`(2) deps.updateSubmission was called ${deps._updateCalls.length} time(s) on a rate-limited request -- must be zero.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: handleMarketingAssetUpload() returns byte-for-byte identical 202/{accepted:true} ' +
    'responses whether or not the target submission exists (while only actually calling ' +
    'uploadFile/updateSubmission when it does), and refuses a heavily-rate-limited key with ' +
    '429 before touching submissionExists/uploadFile/updateSubmission at all.',
);
process.exit(0);
