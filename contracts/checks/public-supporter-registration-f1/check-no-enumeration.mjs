#!/usr/bin/env node
// F1 (public-supporter-registration) — handleSupporterRegistration()'s response BODY must be
// byte-identical (deep-equal JSON) across every reachable success branch: brand-new email,
// already-pending email suppressed by cooldown, already-pending email past cooldown (genuine
// resend), and already-confirmed email. See goldens/README.md "No email enumeration."
//
// A caller must not be able to use this public, unauthenticated endpoint to test whether an
// arbitrary address is already registered — the address being probed may belong to someone who
// never asked to be probed. HTTP status MAY legitimately differ (e.g. 201 for a genuine create
// vs 200 for a no-op), which is why this check compares the BODY only, not the full response.
//
// Defeating mutation: including any branch-distinguishing field in the body (e.g. `alreadyRegistered:
// true`, an echoed status, or a different message string per branch) — any one of the
// deep-equal comparisons below would then fail.
//
// Run as: node --import tsx/esm contracts/checks/public-supporter-registration-f1/check-no-enumeration.mjs

import { handleSupporterRegistration } from '../../../lib/supporter-registration-handler.ts';

const failures = [];
const T0 = new Date('2026-09-01T00:00:00Z');
const PAYLOAD = (email) => ({ email, firstName: 'Casey', consentMarketing: true });

function makeDeps({ existingStatus, lastConfirmationSentAt, ipKeySuffix, now }) {
  let sentAt = lastConfirmationSentAt;
  return {
    now: now ?? T0,
    source: 'website-registration-form',
    rateLimitKey: `supporter-register-ip:${ipKeySuffix}`,
    getPriorAttempts: () => [],
    recordAttempt: () => {},
    findByEmail: async () => (existingStatus === null ? null : { id: 'reg-id', status: existingStatus }),
    getLastConfirmationSentAt: () => sentAt,
    recordConfirmationSent: (_email, at) => {
      sentAt = at;
    },
    write: async () => ({ id: 'reg-id' }),
    refreshConsent: async () => {},
    mintConfirmToken: (registrationId) => ({ token: `token-${registrationId}`, expiresAt: T0 }),
    sendConfirmationEmail: async () => {},
    onEmailError: () => {},
  };
}

const brandNew = await handleSupporterRegistration(
  PAYLOAD('new@example.com'),
  makeDeps({ existingStatus: null, lastConfirmationSentAt: null, ipKeySuffix: 'e1' }),
);

const pendingSuppressed = await handleSupporterRegistration(
  PAYLOAD('pending-cooldown@example.com'),
  makeDeps({ existingStatus: 'pending', lastConfirmationSentAt: T0, ipKeySuffix: 'e2' }),
);

const pendingResend = await handleSupporterRegistration(
  PAYLOAD('pending-resend@example.com'),
  makeDeps({
    existingStatus: 'pending',
    lastConfirmationSentAt: new Date(T0.getTime() - 1000 * 60 * 60),
    ipKeySuffix: 'e3',
  }),
);

const alreadyConfirmed = await handleSupporterRegistration(
  PAYLOAD('confirmed@example.com'),
  makeDeps({ existingStatus: 'confirmed', lastConfirmationSentAt: null, ipKeySuffix: 'e4' }),
);

const cases = [
  ['brand-new', brandNew],
  ['pending, cooldown-suppressed', pendingSuppressed],
  ['pending, genuine resend', pendingResend],
  ['already confirmed', alreadyConfirmed],
];

for (const [label, result] of cases) {
  if (!result.body || result.body.success !== true) {
    failures.push(`${label}: expected a success:true body, got ${JSON.stringify(result.body)}.`);
  }
}

const bodies = cases.map(([, result]) => JSON.stringify(result.body));
const reference = bodies[0];
for (let i = 1; i < bodies.length; i += 1) {
  if (bodies[i] !== reference) {
    failures.push(
      `Response body for "${cases[i][0]}" (${bodies[i]}) differs from "${cases[0][0]}" (${reference}) — ` +
        'a caller could use this difference to enumerate which emails are already registered.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: handleSupporterRegistration() returns a byte-identical response body across all four ' +
    'reachable success branches (brand-new, pending+cooldown-suppressed, pending+genuine ' +
    'resend, already-confirmed) — no branch-distinguishing field lets a caller enumerate ' +
    'whether an arbitrary email is already registered.',
);
process.exit(0);
