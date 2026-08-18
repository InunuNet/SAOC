#!/usr/bin/env node
// F7 (vendor-registration) -- A3: behavioural proof of planProofOfPaymentUpload() (real
// function calls, never source-grep). Proves every allowed mime type under the size limit is
// accepted with a deterministic, mime-derived-extension path; disallowed mime, oversized,
// non-positive/non-integer size, empty/whitespace file name, and a path-traversal-shaped
// submission id are all refused.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-proof-of-payment-plan.mjs

import {
  planProofOfPaymentUpload,
  PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES,
  PROOF_OF_PAYMENT_MAX_BYTES,
} from '../../../lib/vendor-payment.ts';

const failures = [];

const EXPECTED_EXTENSION = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

// (1) Every allowed mime type, well under the limit, is accepted with a deterministic path
// whose extension is derived from the MIME type, never the caller-supplied file name.
for (const mimeType of PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES) {
  const result = planProofOfPaymentUpload({
    submissionId: 'abc123',
    fileName: 'whatever-the-user-named-it.exe', // deliberately wrong extension -- must be ignored
    mimeType,
    sizeBytes: 1024,
  });
  if (!result.ok) {
    failures.push(`(1) mimeType '${mimeType}': expected ok:true, got ok:false: ${result.error}`);
    continue;
  }
  const expectedPath = `vendor-proofs/abc123/proof-of-payment.${EXPECTED_EXTENSION[mimeType]}`;
  if (result.plan.storagePath !== expectedPath) {
    failures.push(`(1) mimeType '${mimeType}': expected storagePath '${expectedPath}', got '${result.plan.storagePath}'.`);
  }
}

// (2) A disallowed mime type is refused, even at a tiny, otherwise-valid size.
{
  const result = planProofOfPaymentUpload({
    submissionId: 'abc123',
    fileName: 'proof.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 1024,
  });
  if (result.ok) {
    failures.push('(2) a disallowed mime type (docx) was accepted -- expected ok:false.');
  }
}

// (3) A file exactly at the byte limit is accepted; one byte over is refused. Proves the
// bound is a real comparison against PROOF_OF_PAYMENT_MAX_BYTES, not an approximate one.
{
  const atLimit = planProofOfPaymentUpload({
    submissionId: 'abc123',
    fileName: 'proof.pdf',
    mimeType: 'application/pdf',
    sizeBytes: PROOF_OF_PAYMENT_MAX_BYTES,
  });
  if (!atLimit.ok) {
    failures.push(`(3a) a file exactly at PROOF_OF_PAYMENT_MAX_BYTES (${PROOF_OF_PAYMENT_MAX_BYTES}) was refused: ${atLimit.error}`);
  }

  const overLimit = planProofOfPaymentUpload({
    submissionId: 'abc123',
    fileName: 'proof.pdf',
    mimeType: 'application/pdf',
    sizeBytes: PROOF_OF_PAYMENT_MAX_BYTES + 1,
  });
  if (overLimit.ok) {
    failures.push(`(3b) a file one byte over PROOF_OF_PAYMENT_MAX_BYTES was accepted -- expected ok:false.`);
  }
}

// (4) Non-positive or non-integer sizes are refused.
for (const sizeBytes of [0, -1, 1.5]) {
  const result = planProofOfPaymentUpload({
    submissionId: 'abc123',
    fileName: 'proof.pdf',
    mimeType: 'application/pdf',
    sizeBytes,
  });
  if (result.ok) {
    failures.push(`(4) sizeBytes=${sizeBytes}: expected ok:false, got ok:true.`);
  }
}

// (5) An empty or whitespace-only file name is refused.
for (const fileName of ['', '   ']) {
  const result = planProofOfPaymentUpload({
    submissionId: 'abc123',
    fileName,
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  });
  if (result.ok) {
    failures.push(`(5) fileName=${JSON.stringify(fileName)}: expected ok:false, got ok:true.`);
  }
}

// (6) A submission id shaped to escape the storage prefix (path separators, '..') is refused,
// and never appears verbatim in a successful storagePath -- since it can't succeed at all.
for (const submissionId of ['../../etc/passwd', 'abc/def', 'abc..def/', '']) {
  const result = planProofOfPaymentUpload({
    submissionId,
    fileName: 'proof.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  });
  if (result.ok) {
    failures.push(`(6) submissionId=${JSON.stringify(submissionId)}: expected ok:false, got ok:true with storagePath '${result.plan.storagePath}'.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: planProofOfPaymentUpload() accepts every allowed mime type under the byte limit with ' +
    'a mime-derived (never file-name-derived) deterministic path, accepts exactly at the byte ' +
    'limit and refuses one byte over, refuses non-positive/non-integer sizes, refuses ' +
    'empty/whitespace file names, and refuses path-traversal-shaped or empty submission ids.',
);
process.exit(0);
