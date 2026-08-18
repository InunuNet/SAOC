#!/usr/bin/env node
// F5 (vendor-registration) — design constraint 4: rate limiting is enforced at the handler
// level, before Firestore or email are ever touched. deps.getPriorAttempts is pre-seeded with
// VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS prior attempts for a given key; a fully valid payload
// under that same key must be refused with 429 and deps.write/deps.sendConfirmationEmail must
// both be proven called ZERO times. A second call under a DIFFERENT key with a valid payload
// must succeed normally (201, write called once) in the same run, proving the 429 above wasn't
// a global "nothing works" failure.
//
// Defeating mutation: moving the rate-limit check to after the Firestore write — the zero-calls
// assertion on deps.write would then fail.
//
// Run as: npx tsx contracts/checks/vendor-f5-register-route/check-rate-limit-shields-write.mjs

import { handleVendorRegistration } from '../../../lib/vendor-registration-handler.ts';
import { VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS } from '../../../lib/vendor-registration-rate-limit.ts';

const failures = [];
const NOW = new Date('2027-01-05T12:00:00Z');

const VALID_PAYLOAD = {
  businessName: 'Test Nursery',
  contactPersonName: 'Jane Grower',
  contactCellPhone: '+27821234567',
  contactEmail: 'jane@example.com',
  productDescription: 'Cymbidium and Cattleya orchids',
  vendorCategory: ['plant-sales'],
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

function makeDeps(key, priorAttempts) {
  const writeCalls = [];
  const emailCalls = [];
  return {
    now: NOW,
    rateLimitKey: key,
    getPriorAttempts: (queriedKey) => (queriedKey === key ? priorAttempts : []),
    recordAttempt: () => {},
    write: async (doc) => {
      writeCalls.push(doc);
      return { id: 'write-id-for-' + key };
    },
    sendConfirmationEmail: async (input) => {
      emailCalls.push(input);
    },
    onEmailError: () => {},
    _writeCalls: writeCalls,
    _emailCalls: emailCalls,
  };
}

// (1) A key pre-seeded with exactly MAX_ATTEMPTS prior attempts, all within the window, must be
// refused with 429 BEFORE Firestore/email are touched, even with a fully valid payload.
{
  const rateLimitedKey = 'vendor-register-ip:203.0.113.99';
  const priorAttempts = Array.from({ length: VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS }, (_, i) => ({
    key: rateLimitedKey,
    at: new Date(NOW.getTime() - (i + 1) * 60 * 1000),
  }));
  const deps = makeDeps(rateLimitedKey, priorAttempts);

  const result = await handleVendorRegistration(VALID_PAYLOAD, deps);

  if (result.status !== 429) {
    failures.push(`(1) expected status 429 for a fully rate-limited key with a valid payload, got ${result.status}.`);
  }
  if (deps._writeCalls.length !== 0) {
    failures.push(`(1) deps.write was called ${deps._writeCalls.length} time(s) on a rate-limited request — must be zero.`);
  }
  if (deps._emailCalls.length !== 0) {
    failures.push(`(1) deps.sendConfirmationEmail was called ${deps._emailCalls.length} time(s) on a rate-limited request — must be zero.`);
  }
}

// (2) A DIFFERENT key with no prior attempts and the same valid payload must succeed normally
// in the SAME run — proving (1)'s refusal is scoped to its own key, not a global failure.
{
  const freshKey = 'vendor-register-ip:198.51.100.42';
  const deps = makeDeps(freshKey, []);

  const result = await handleVendorRegistration(VALID_PAYLOAD, deps);

  if (result.status !== 201) {
    failures.push(`(2) expected status 201 for a fresh, unrate-limited key with a valid payload, got ${result.status}.`);
  }
  if (deps._writeCalls.length !== 1) {
    failures.push(`(2) expected deps.write called exactly once for a successful submission, got ${deps._writeCalls.length}.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a key pre-seeded with VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS prior attempts is refused ' +
    'with 429 before deps.write/deps.sendConfirmationEmail are ever called, while a different, ' +
    'unrate-limited key succeeds normally (201, write called once) in the same run.',
);
process.exit(0);
