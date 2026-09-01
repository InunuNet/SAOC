#!/usr/bin/env node
// F5 (vendor-registration) — design constraint 1: handleVendorRegistration()'s 400 rejection
// path is a direct pass-through of the REAL validateVendorSubmissionInput() (lib/vendor-submissions.ts,
// F4) error list — not a second, hand-written validation routine that happens to also reject a
// bad payload. Proven by deep-equal comparison against calling the real validator directly on
// the identical payload, for a single-omission case AND a two-omission case (a case combining
// two independent failures must name BOTH, not collapse into one generic message).
//
// Defeating mutation: hardcoding a generic `['Invalid submission.']` fieldErrors array (or any
// fixed-shape error list) instead of forwarding validateVendorSubmissionInput()'s real return
// value — both payloads below would still produce a 400, but the deep-equal check against the
// real validator's actual output would fail for either case.
//
// No Firestore, no network, no Resend — deps.write/deps.sendConfirmationEmail are spies that
// must never be called (validation fails before either is reached).
//
// Run as: npx tsx contracts/checks/vendor-f5-register-route/check-no-parallel-validation.mjs

import { handleVendorRegistration } from '../../../lib/vendor-registration-handler.ts';
import { validateVendorSubmissionInput } from '../../../lib/vendor-submissions.ts';

const failures = [];
const NOW = new Date('2027-01-05T00:00:00Z');

const VALID_PAYLOAD = {
  businessName: 'Test Nursery',
  contactPersonName: 'Jane Grower',
  contactCellPhone: '+27821234567',
  contactEmail: 'jane@example.com',
  physicalAddress: '12 Orchid Lane, Stellenbosch, Western Cape, 7600',
  emergencyContactName: 'Peter Grower',
  emergencyContactCellPhone: '+27829876543',
  productDescription: 'Cymbidium and Cattleya orchids',
  vendorCategory: ['orchids'],
  boothCount: 1,
  boothSize: 'single',
  powerRequired: true,
  termsAccepted: true,
};

function makeDeps(overrides = {}) {
  const writeCalls = [];
  const emailCalls = [];
  return {
    now: NOW,
    rateLimitKey: 'vendor-register-ip:203.0.113.5',
    getPriorAttempts: () => [],
    recordAttempt: () => {},
    write: async (doc) => {
      writeCalls.push(doc);
      return { id: 'unexpected-write' };
    },
    sendConfirmationEmail: async (input) => {
      emailCalls.push(input);
    },
    onEmailError: () => {},
    _writeCalls: writeCalls,
    _emailCalls: emailCalls,
    ...overrides,
  };
}

async function checkCase(label, payload) {
  const realValidation = validateVendorSubmissionInput(payload);
  if (realValidation.valid) {
    failures.push(`${label}: fixture payload was expected to be invalid but the real validator accepted it — fix the test fixture.`);
    return;
  }

  const deps = makeDeps();
  const result = await handleVendorRegistration(payload, deps);

  if (result.status !== 400) {
    failures.push(`${label}: handleVendorRegistration returned status ${result.status}, expected 400.`);
  }

  const actualErrors = result.body && 'fieldErrors' in result.body ? result.body.fieldErrors : undefined;
  const expectedErrors = realValidation.errors;
  if (JSON.stringify(actualErrors) !== JSON.stringify(expectedErrors)) {
    failures.push(
      `${label}: handleVendorRegistration's fieldErrors (${JSON.stringify(actualErrors)}) did not ` +
        `deep-equal the real validateVendorSubmissionInput() output (${JSON.stringify(expectedErrors)}) ` +
        `for the identical payload — the handler is not forwarding the real validator's errors.`,
    );
  }

  if (deps._writeCalls.length > 0) {
    failures.push(`${label}: deps.write was called ${deps._writeCalls.length} time(s) on an invalid payload — validation must reject before any Firestore write is attempted.`);
  }
  if (deps._emailCalls.length > 0) {
    failures.push(`${label}: deps.sendConfirmationEmail was called ${deps._emailCalls.length} time(s) on an invalid payload.`);
  }
}

// (1) Single omission — businessName missing.
{
  const payload = { ...VALID_PAYLOAD };
  delete payload.businessName;
  await checkCase('(1) businessName omitted', payload);
}

// (2) Two independent omissions in one payload — contactEmail missing AND termsAccepted not
// true. A defect that only names the first failure it finds, or collapses to one generic
// message, must be caught here: both omissions must appear, verbatim, in the real validator's
// error list, and the handler's fieldErrors must still deep-equal that full list.
{
  const payload = { ...VALID_PAYLOAD, termsAccepted: false };
  delete payload.contactEmail;

  const realValidation = validateVendorSubmissionInput(payload);
  const namesContactEmail = realValidation.errors.some((e) => e.includes('contactEmail'));
  const namesTermsAccepted = realValidation.errors.some((e) => e.includes('termsAccepted'));
  if (!namesContactEmail || !namesTermsAccepted) {
    failures.push(
      `(2) fixture sanity check failed: the real validator's error list ` +
        `(${JSON.stringify(realValidation.errors)}) must name BOTH contactEmail and termsAccepted ` +
        `for this case to prove anything about combined-omission handling.`,
    );
  }

  await checkCase('(2) contactEmail omitted AND termsAccepted false', payload);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: handleVendorRegistration() rejects an invalid payload with the exact same fieldErrors ' +
    'the real validateVendorSubmissionInput() produces for the identical payload, for both a ' +
    'single-omission case and a two-omission case (both omissions named, not collapsed into one ' +
    'generic message), and never calls deps.write or deps.sendConfirmationEmail on an invalid payload.',
);
process.exit(0);
