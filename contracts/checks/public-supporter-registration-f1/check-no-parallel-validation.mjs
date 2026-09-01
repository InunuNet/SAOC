#!/usr/bin/env node
// F1 (public-supporter-registration) — handleSupporterRegistration()'s 400 rejection path must
// be a direct pass-through of the REAL validateSupporterRegistrationInput() error list, not a
// second, hand-written validation routine. Proven by deep-equal comparison against calling the
// real validator directly on the identical payload — same method as
// contracts/checks/vendor-f5-register-route/check-no-parallel-validation.mjs's A3/A4.
//
// Defeating mutation: hardcoding a generic ['Invalid submission.'] fieldErrors array instead of
// forwarding the real validator's return value.
//
// Run as: node --import tsx/esm contracts/checks/public-supporter-registration-f1/check-no-parallel-validation.mjs

import { validateSupporterRegistrationInput } from '../../../lib/supporter-registrations.ts';
import { handleSupporterRegistration } from '../../../lib/supporter-registration-handler.ts';

const failures = [];
const NOW = new Date('2026-09-01T00:00:00Z');

function makeDeps() {
  const writeCalls = [];
  const emailCalls = [];
  return {
    now: NOW,
    source: 'website-registration-form',
    rateLimitKey: 'supporter-register-ip:203.0.113.10',
    getPriorAttempts: () => [],
    recordAttempt: () => {},
    findByEmail: async () => null,
    getLastConfirmationSentAt: () => null,
    recordConfirmationSent: () => {},
    write: async (doc) => {
      writeCalls.push(doc);
      return { id: 'unexpected' };
    },
    refreshConsent: async () => {},
    mintConfirmToken: () => ({ token: 'unexpected', expiresAt: NOW }),
    sendConfirmationEmail: async (input) => {
      emailCalls.push(input);
    },
    onEmailError: () => {},
    _writeCalls: writeCalls,
    _emailCalls: emailCalls,
  };
}

async function checkCase(label, payload) {
  const realValidation = validateSupporterRegistrationInput(payload);
  if (realValidation.valid) {
    failures.push(`${label}: fixture payload was expected to be invalid but the real validator accepted it.`);
    return;
  }

  const deps = makeDeps();
  const result = await handleSupporterRegistration(payload, deps);

  if (result.status !== 400) {
    failures.push(`${label}: handleSupporterRegistration returned status ${result.status}, expected 400.`);
  }

  const actualErrors = 'fieldErrors' in result.body ? result.body.fieldErrors : undefined;
  const expectedErrors = realValidation.errors;
  if (JSON.stringify(actualErrors) !== JSON.stringify(expectedErrors)) {
    failures.push(
      `${label}: handleSupporterRegistration's fieldErrors (${JSON.stringify(actualErrors)}) ` +
        `did not deep-equal the real validateSupporterRegistrationInput() output ` +
        `(${JSON.stringify(expectedErrors)}) for the identical payload.`,
    );
  }

  if (deps._writeCalls.length > 0) {
    failures.push(`${label}: deps.write was called ${deps._writeCalls.length} time(s) on an invalid payload.`);
  }
  if (deps._emailCalls.length > 0) {
    failures.push(`${label}: deps.sendConfirmationEmail was called ${deps._emailCalls.length} time(s) on an invalid payload.`);
  }
}

// (1) Single omission — email missing.
await checkCase('(1) email omitted', { firstName: 'Jane', consentMarketing: true });

// (2) Two independent omissions/malformations in one payload — email malformed AND
// consentMarketing absent. Both must appear in the real validator's error list and both must
// survive into the handler's forwarded fieldErrors, not collapse into one generic message.
{
  const payload = { email: 'not-an-email', firstName: 'Jane' };
  const realValidation = validateSupporterRegistrationInput(payload);
  const namesEmail = realValidation.errors.some((e) => e.includes('email'));
  const namesConsent = realValidation.errors.some((e) => e.includes('consentMarketing'));
  if (!namesEmail || !namesConsent) {
    failures.push(
      `(2) fixture sanity check failed: the real validator's error list ` +
        `(${JSON.stringify(realValidation.errors)}) must name BOTH email and consentMarketing.`,
    );
  }
  await checkCase('(2) email malformed AND consentMarketing omitted', payload);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: handleSupporterRegistration() rejects an invalid payload with the exact same ' +
    'fieldErrors the real validateSupporterRegistrationInput() produces for the identical ' +
    'payload, for a single-omission case and a two-omission case, and never calls deps.write ' +
    'or deps.sendConfirmationEmail on an invalid payload.',
);
process.exit(0);
