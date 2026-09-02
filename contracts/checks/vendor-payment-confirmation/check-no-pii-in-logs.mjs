#!/usr/bin/env node
// vendor-payment-confirmation F1 -- A5: NO-PII-IN-LOGS, paired absence+presence, on the NEW
// lib/vendor-payment-confirmation.ts. Matches the rule every existing vendor-email sender in
// this project already follows (lib/vendor-stand-payment-notice.ts, lib/vendor-registration-
// confirmation.ts, lib/vendor-application-confirmation.ts): businessName/contactEmail are
// POPIA-relevant submitter PII and must never reach a log line, so the file must contain ZERO
// console.* calls -- not "zero console.* calls that happen to log PII", zero, period, matching
// the sibling files' own absolute rule (their own doc comments state this explicitly).
//
// Presence half: the file must genuinely reference contactEmail and businessName somewhere
// (proves it is a real implementation reading real fields, not an empty stub that trivially
// passes the absence half by doing nothing at all).
//
// Run as: node contracts/checks/vendor-payment-confirmation/check-no-pii-in-logs.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const KNOWN_BAD_FIXTURE_WITH_PII_LOG = `
export async function sendVendorPaymentConfirmationEmail(input, deps = {}) {
  console.log('[vendor-payment-confirmation] sending to', input.contactEmail, input.businessName);
  const mailer = deps.mailer ?? { send: sendEmail };
  await mailer.send({ to: input.contactEmail, subject: 'x', react: null, from: FORMS_FROM_ADDRESS });
}
`;

const KNOWN_BAD_FIXTURE_EMPTY_STUB = `
export async function sendVendorPaymentConfirmationEmail(input, deps = {}) {
  return;
}
`;

function checkSource(source) {
  const failures = [];
  const consoleCallCount = (source.match(/console\.\w+\s*\(/g) ?? []).length;
  if (consoleCallCount > 0) {
    failures.push(`contains ${consoleCallCount} console.* call(s) -- must contain zero, same absolute rule every sibling vendor-email sender follows`);
  }
  const referencesContactEmail = /\bcontactEmail\b/.test(source);
  const referencesBusinessName = /\bbusinessName\b/.test(source);
  if (!referencesContactEmail || !referencesBusinessName) {
    failures.push(`does not genuinely reference both contactEmail and businessName (contactEmail=${referencesContactEmail}, businessName=${referencesBusinessName}) -- looks like an empty stub, not a real implementation`);
  }
  return { clean: failures.length === 0, failures };
}

// Self-test: the discriminator must reject BOTH known-bad fixtures (a PII-logging
// implementation, and a vacuous empty stub that would otherwise pass the absence half for the
// wrong reason).
for (const [name, fixture] of [
  ['KNOWN_BAD_FIXTURE_WITH_PII_LOG', KNOWN_BAD_FIXTURE_WITH_PII_LOG],
  ['KNOWN_BAD_FIXTURE_EMPTY_STUB', KNOWN_BAD_FIXTURE_EMPTY_STUB],
]) {
  const selfTest = checkSource(fixture);
  if (selfTest.clean) {
    console.error(`FAIL (self-test): discriminator accepted the KNOWN-BAD fixture "${name}" -- the discriminator itself is broken.`);
    process.exit(1);
  }
}

const targetPath = path.join(REPO_ROOT, 'lib/vendor-payment-confirmation.ts');
if (!existsSync(targetPath)) {
  console.error(`FAIL: ${targetPath} does not exist.`);
  process.exit(1);
}

const result = checkSource(readFileSync(targetPath, 'utf8'));
if (!result.clean) {
  result.failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${result.failures.length} assertion(s) failed against ${targetPath}.`);
  process.exit(1);
}

console.log(
  'PASS: lib/vendor-payment-confirmation.ts contains zero console.* calls and genuinely ' +
    'references both contactEmail and businessName; the discriminator rejects both a ' +
    'PII-logging fixture and a vacuous empty-stub fixture.',
);
process.exit(0);
