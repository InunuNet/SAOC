#!/usr/bin/env node
// F9 (vendor-registration) — A3. Proves the vendor-facing confirmation email
// (emails/VendorRegistrationConfirmation.tsx, F5) states that permit/certificate numbers are
// recorded as supplied and NOT verified by SAOC, and that the vendor retains legal
// responsibility for them. Before F9, this file's own comment says exactly this note is
// deferred ("no regulatory permit non-verification note (that is F9's later edit to this same
// file)") -- so absence of both required phrases is the expected pre-F9 state, and this
// assertion is a positive discriminator.
//
// Two required phrases (both must be present, case-insensitive, normalised whitespace):
//   1. a non-verification statement: matches /not verifi|does not verify/i
//   2. a legal-responsibility statement: matches /legal responsibility/i
//
// DEFEATING MUTATION: adding only one of the two phrases; adding the note as a code comment
// instead of rendered email copy; adding the note to a different, unrelated email component.
//
// Self-tests against fixtures/email-wired.tsx (must PASS) and fixtures/email-unwired.tsx (must
// FAIL) before trusting the live repository file.
//
// Run as: node contracts/checks/vendor-f9-permit-posture/check-email-non-verification-note.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalize } from './lib-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const NON_VERIFICATION_RE = /not verifi|does not verify/i;
const LEGAL_RESPONSIBILITY_RE = /legal responsibility/i;

function evaluate(source) {
  const norm = normalize(source);
  const failures = [];
  if (!NON_VERIFICATION_RE.test(norm)) {
    failures.push('missing non-verification statement (expected wording like "not verified" / "does not verify")');
  }
  if (!LEGAL_RESPONSIBILITY_RE.test(norm)) {
    failures.push('missing legal-responsibility statement (expected the phrase "legal responsibility")');
  }
  return failures;
}

// --- Self-test ---------------------------------------------------------

const wired = readFileSync(path.join(__dirname, 'fixtures/email-wired.tsx'), 'utf8');
const unwired = readFileSync(path.join(__dirname, 'fixtures/email-unwired.tsx'), 'utf8');

const wiredFailures = evaluate(wired);
if (wiredFailures.length !== 0) {
  console.error(`SELF-TEST FAILED: WIRED golden should pass but reported: ${wiredFailures.join('; ')}`);
  process.exit(1);
}

const unwiredFailures = evaluate(unwired);
if (unwiredFailures.length !== 2) {
  console.error('SELF-TEST FAILED: UNWIRED fixture should fail both phrase checks.');
  process.exit(1);
}

// --- Real check ----------------------------------------------------------

const targetFile = path.join(REPO_ROOT, 'emails/VendorRegistrationConfirmation.tsx');
const source = readFileSync(targetFile, 'utf8');
const failures = evaluate(source);

if (failures.length > 0) {
  console.error(`FAIL: ${path.relative(REPO_ROOT, targetFile)} — ${failures.join('; ')}`);
  process.exit(1);
}

console.log('PASS: vendor confirmation email states permits are unverified and remain the vendor\'s legal responsibility.');
process.exit(0);
