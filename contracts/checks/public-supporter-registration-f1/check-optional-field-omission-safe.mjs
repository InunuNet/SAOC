#!/usr/bin/env node
// F1 (public-supporter-registration) — class-level defeat of the defect Codex found on
// 2026-09-01: `firstName` is optional (validateSupporterRegistrationInput permits it entirely
// absent from the raw request body — not merely `null`), but the write-time normalisation
// downstream unconditionally called `.trim()` on it, crashing on the omitted-key case. None of
// A1-A11 caught this because every fixture payload in this contract sets `firstName` explicitly
// (a string, or `null`) — none omits the KEY itself, which is the actual shape a POST body
// takes when the browser form leaves the field blank and JSON.stringify drops undefined keys.
//
// This check is the general form, same shape as A42 in vendor-gated-registration-flow ("every
// persisted field validated"): for EVERY field validateSupporterRegistrationInput() treats as
// optional, a payload with that key entirely OMITTED (not set to null/undefined — deleted)
// must survive validate -> buildSupporterRegistration -> handleSupporterRegistration end to
// end without throwing, and the resulting persisted record must carry the documented default
// for that field (null, per goldens/supporter-registration-data-model.md), not `undefined` or
// a TypeError.
//
// Defeating mutation: any unconditional (non-null-checked) call on an optional field in
// buildSupporterRegistration or handleSupporterRegistration's raw-input coercion step —
// `.trim()`, `.toLowerCase()`, string concatenation via template literal — reached before a
// `=== null` / `=== undefined` / `??` guard.
//
// Run as: npx tsx contracts/checks/public-supporter-registration-f1/check-optional-field-omission-safe.mjs

import {
  validateSupporterRegistrationInput,
  buildSupporterRegistration,
} from '../../../lib/supporter-registrations.ts';
import { handleSupporterRegistration } from '../../../lib/supporter-registration-handler.ts';

const failures = [];
const NOW = new Date('2026-09-01T00:00:00Z');

function makeDeps() {
  const writeCalls = [];
  const emailCalls = [];
  return {
    now: NOW,
    source: 'website-registration-form',
    rateLimitKey: 'supporter-register-ip:203.0.113.11',
    getPriorAttempts: () => [],
    recordAttempt: () => {},
    findByEmail: async () => null,
    getLastConfirmationSentAt: () => null,
    recordConfirmationSent: () => {},
    write: async (doc) => {
      writeCalls.push(doc);
      return { id: 'new-registration-id' };
    },
    refreshConsent: async () => {},
    mintConfirmToken: () => ({ token: 'tok', expiresAt: NOW }),
    sendConfirmationEmail: async (input) => {
      emailCalls.push(input);
    },
    onEmailError: () => {},
    _writeCalls: writeCalls,
    _emailCalls: emailCalls,
  };
}

// Only ONE field is optional on the raw shape today (firstName) — but this check is written to
// re-run cleanly if a second optional field is ever added, by listing every field name here
// rather than hardcoding a single-field payload.
const OPTIONAL_FIELDS = ['firstName'];

const BASE_VALID_PAYLOAD = {
  email: 'omitted-field-check@example.com',
  firstName: 'Placeholder',
  consentMarketing: true,
};

for (const field of OPTIONAL_FIELDS) {
  const payload = { ...BASE_VALID_PAYLOAD };
  delete payload[field]; // genuinely absent key, not `field: undefined`
  if (field in payload) {
    failures.push(`Fixture bug: '${field}' still present in payload after delete.`);
    continue;
  }

  // (1) The pure validator must accept the omission (it's optional) and never itself throw.
  let validation;
  try {
    validation = validateSupporterRegistrationInput(payload);
  } catch (error) {
    failures.push(
      `validateSupporterRegistrationInput() threw on '${field}' omitted entirely: ${error.message}`,
    );
    continue;
  }
  if (!validation.valid) {
    failures.push(
      `validateSupporterRegistrationInput() rejected '${field}' omitted entirely (expected valid, ` +
        `since it's documented optional): ${JSON.stringify(validation.errors)}`,
    );
    continue;
  }

  // (2) buildSupporterRegistration() must not throw when called on the build-shaped input this
  // handler actually derives from an omitted optional key (i.e. coerced to null, the documented
  // default — see lib/supporter-registration-handler.ts's raw-input coercion step).
  let built;
  try {
    built = buildSupporterRegistration({ email: payload.email, firstName: null, consentMarketing: true }, NOW);
  } catch (error) {
    failures.push(`buildSupporterRegistration() threw with '${field}': null (the omitted-key default): ${error.message}`);
  }
  if (built && built.firstName !== null) {
    failures.push(
      `buildSupporterRegistration() produced firstName: ${JSON.stringify(built.firstName)} for an omitted ` +
        `'${field}' — expected the documented default null.`,
    );
  }

  // (3) End to end through the real orchestrator with the field genuinely absent from the raw
  // request-shaped object (not present as any value, including undefined) — this is the exact
  // shape a parsed JSON body takes when a form omits the field entirely.
  const deps = makeDeps();
  let result;
  try {
    result = await handleSupporterRegistration(payload, deps);
  } catch (error) {
    failures.push(
      `handleSupporterRegistration() threw with '${field}' entirely omitted from the raw payload: ` +
        `${error.message}\n${error.stack}`,
    );
    continue;
  }
  if (result.status !== 201) {
    failures.push(
      `handleSupporterRegistration() returned status ${result.status} (expected 201, a brand-new ` +
        `registration) for a payload with only the optional '${field}' omitted — everything else valid.`,
    );
  }
  if (deps._writeCalls.length !== 1) {
    failures.push(
      `handleSupporterRegistration() called deps.write ${deps._writeCalls.length} time(s) for a valid ` +
        `payload with '${field}' omitted (expected exactly 1).`,
    );
  } else if (deps._writeCalls[0].firstName !== null) {
    failures.push(
      `The persisted record's firstName was ${JSON.stringify(deps._writeCalls[0].firstName)} for a payload ` +
        `with '${field}' omitted — expected the documented default null.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: every field validateSupporterRegistrationInput() treats as optional survives being ' +
    'entirely OMITTED (not null, not undefined-valued — the key itself absent) through ' +
    'validate -> buildSupporterRegistration -> handleSupporterRegistration without throwing, ' +
    'and the persisted record carries the documented null default.',
);
process.exit(0);
