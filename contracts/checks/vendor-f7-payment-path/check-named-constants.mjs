#!/usr/bin/env node
// F7 (vendor-registration) -- A4: no-magic-numbers proof for lib/vendor-payment.ts. Structural
// source check: the module must export PROOF_OF_PAYMENT_MAX_BYTES and
// PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES as top-level named constants, and
// planProofOfPaymentUpload()'s body must reference the constant identifier for its size
// comparison -- never a bare numeric literal duplicating the byte limit inline.
//
// DEFEATING MUTATION: replacing `input.sizeBytes > PROOF_OF_PAYMENT_MAX_BYTES` with a hardcoded
// `input.sizeBytes > 5242880` (or any other bare literal) inside the function body.
//
// Run as: node contracts/checks/vendor-f7-payment-path/check-named-constants.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(__dirname, '../../../lib/vendor-payment.ts');

const failures = [];
const source = readFileSync(TARGET, 'utf8');

if (!/export const PROOF_OF_PAYMENT_MAX_BYTES\s*=/.test(source)) {
  failures.push("PROOF_OF_PAYMENT_MAX_BYTES is not exported as a top-level named constant.");
}

if (!/export const PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES\s*=/.test(source)) {
  failures.push("PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES is not exported as a top-level named constant.");
}

// The function body must compare sizeBytes against the named constant identifier.
if (!/sizeBytes\s*>\s*PROOF_OF_PAYMENT_MAX_BYTES/.test(source)) {
  failures.push(
    "planProofOfPaymentUpload() does not compare sizeBytes against the named " +
      "PROOF_OF_PAYMENT_MAX_BYTES constant -- expected a `sizeBytes > PROOF_OF_PAYMENT_MAX_BYTES` " +
      "comparison, found none. A bare numeric literal in its place is the defeating mutation this " +
      "check exists to catch.",
  );
}

// A bare multi-digit numeric literal (5+ digits, i.e. byte-count-shaped) appearing anywhere
// other than the constant's own declaration line is a strong signal the limit was re-inlined.
const lines = source.split('\n');
for (const [index, line] of lines.entries()) {
  if (/PROOF_OF_PAYMENT_MAX_BYTES\s*=/.test(line)) continue; // the declaration itself
  if (/\b\d{5,}\b/.test(line) && /sizeBytes/.test(line)) {
    failures.push(`A bare 5+ digit numeric literal appears alongside 'sizeBytes' on line ${index + 1}, outside the constant's own declaration: "${line.trim()}"`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: lib/vendor-payment.ts declares PROOF_OF_PAYMENT_MAX_BYTES and ' +
    'PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES as top-level named constants, and ' +
    'planProofOfPaymentUpload() compares against the named constant, not a re-inlined literal.',
);
process.exit(0);
