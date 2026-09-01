#!/usr/bin/env node
// F1 (public-supporter-registration) — design constraint: `consentMarketing` must be the
// LITERAL boolean `true`, never a truthy coercion and never defaulted, at BOTH the pure
// validator and the handler level. This is the data-model half of "no pre-ticked box" — see
// goldens/README.md "Consent design." A regression here is exactly the kind of silent-default
// bug that would make the record exist without real consent behind it.
//
// Class, not instance: five distinct non-`true` values are each checked to fail identically
// (not just one hand-picked bad case), plus the field being entirely absent, plus the literal
// `true` case succeeding to prove the check isn't just rejecting everything.
//
// Defeating mutation: `consentMarketing: Boolean(raw.consentMarketing)` (coerces "true"/1/"on"
// to true) or `consentMarketing: raw.consentMarketing ?? true` (silently defaults missing to
// true) — either would make one or more of the FAIL cases below wrongly report `valid: true`.
//
// Run as: node --import tsx/esm contracts/checks/public-supporter-registration-f1/check-consent-is-explicit.mjs

import {
  validateSupporterRegistrationInput,
  buildSupporterRegistration,
} from '../../../lib/supporter-registrations.ts';
import { handleSupporterRegistration } from '../../../lib/supporter-registration-handler.ts';

const failures = [];
const NOW = new Date('2026-09-01T00:00:00Z');

const BASE = { email: 'jane@example.com', firstName: 'Jane' };

const NON_CONSENT_VALUES = [
  { label: 'string "true"', value: 'true' },
  { label: 'number 1', value: 1 },
  { label: 'string "on"', value: 'on' },
  { label: 'boolean false', value: false },
  { label: 'null', value: null },
];

for (const { label, value } of NON_CONSENT_VALUES) {
  const result = validateSupporterRegistrationInput({ ...BASE, consentMarketing: value });
  if (result.valid) {
    failures.push(`consentMarketing = ${label} was accepted as valid — must be rejected.`);
  } else if (!result.errors.some((e) => e.includes('consentMarketing'))) {
    failures.push(
      `consentMarketing = ${label} was rejected, but no error names "consentMarketing" ` +
        `(errors: ${JSON.stringify(result.errors)}).`,
    );
  }
}

// Field entirely absent — must fail exactly like an explicit false, not be silently defaulted.
{
  const { consentMarketing: _omit, ...withoutConsent } = { ...BASE, consentMarketing: true };
  const result = validateSupporterRegistrationInput(withoutConsent);
  if (result.valid) {
    failures.push('consentMarketing omitted entirely was accepted as valid — must be rejected.');
  } else if (!result.errors.some((e) => e.includes('consentMarketing'))) {
    failures.push(
      `consentMarketing omitted was rejected, but no error names "consentMarketing" ` +
        `(errors: ${JSON.stringify(result.errors)}).`,
    );
  }
}

// The literal `true` case must succeed — proves the check isn't rejecting everything.
{
  const result = validateSupporterRegistrationInput({ ...BASE, consentMarketing: true });
  if (!result.valid) {
    failures.push(
      `consentMarketing = true (with a valid email) was rejected — errors: ${JSON.stringify(result.errors)}.`,
    );
  }
}

// Handler-level: an invalid consent value must produce 400 with consentMarketing named, and
// must never reach deps.write or deps.sendConfirmationEmail.
async function checkHandlerRejects(label, consentMarketing) {
  const writeCalls = [];
  const emailCalls = [];
  const deps = {
    now: NOW,
    source: 'website-registration-form',
    rateLimitKey: 'supporter-register-ip:203.0.113.9',
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
  };

  const result = await handleSupporterRegistration({ ...BASE, consentMarketing }, deps);

  if (result.status !== 400) {
    failures.push(`handler: ${label} — expected status 400, got ${result.status}.`);
  }
  const fieldErrors = 'fieldErrors' in result.body ? result.body.fieldErrors : undefined;
  if (!Array.isArray(fieldErrors) || !fieldErrors.some((e) => e.includes('consentMarketing'))) {
    failures.push(
      `handler: ${label} — fieldErrors did not name consentMarketing (got ${JSON.stringify(fieldErrors)}).`,
    );
  }
  if (writeCalls.length > 0) {
    failures.push(`handler: ${label} — deps.write was called ${writeCalls.length} time(s) on invalid consent.`);
  }
  if (emailCalls.length > 0) {
    failures.push(`handler: ${label} — deps.sendConfirmationEmail was called ${emailCalls.length} time(s) on invalid consent.`);
  }
}

await checkHandlerRejects('consentMarketing: "true" (string)', 'true');
await checkHandlerRejects('consentMarketing: false', false);

// Sanity: buildSupporterRegistration's output type only accepts the literal `true` — proven at
// compile time by A2's fixture, not here; this file is the runtime half.

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: consentMarketing must be the literal boolean true — every non-true value (string ' +
    '"true", 1, "on", false, null) and total omission is rejected by the field validator with ' +
    'an error naming consentMarketing, the handler mirrors that rejection with 400 and zero ' +
    'write/email calls, and the literal true value is accepted.',
);
process.exit(0);
