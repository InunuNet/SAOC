#!/usr/bin/env node
// F1 (public-supporter-registration) — the per-email confirmation-send cooldown is the
// mail-bomb defense described in goldens/README.md "Abuse protection": an IP-only rate limit
// does nothing to stop someone submitting a THIRD PARTY's address repeatedly from different
// IPs to flood that inbox with confirmation emails. This checks the cooldown is genuinely
// wired into handleSupporterRegistration for the 'pending, resubmitted' branch, keyed on the
// EMAIL (not the IP), and independent of the IP rate limiter (a fresh IP key each call, so the
// IP limiter alone would allow every call in this test).
//
// Defeating mutation: re-sending the confirmation email on every resubmission of a pending
// registration regardless of decideConfirmationEmailCooldown's decision (deleting or
// no-op'ing the cooldown check) — case (2) below would then wrongly show a second email sent.
//
// Run as: node --import tsx/esm contracts/checks/public-supporter-registration-f1/check-email-cooldown-suppresses-resend.mjs

import { handleSupporterRegistration } from '../../../lib/supporter-registration-handler.ts';
import { SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS } from '../../../lib/supporter-registration-rate-limit.ts';

const failures = [];
const EMAIL = 'victim@example.com';
const T0 = new Date('2026-09-01T00:00:00Z');

function makeDeps({ existingStatus, lastConfirmationSentAt, ipKeySuffix }) {
  const emailCalls = [];
  const writeCalls = [];
  const refreshCalls = [];
  let sentAt = lastConfirmationSentAt;

  return {
    deps: {
      now: T0,
      source: 'website-registration-form',
      // A FRESH IP key per call — proves any suppression seen here is the email cooldown,
      // not the IP rate limiter (which would need repeated calls on the SAME key to trigger).
      rateLimitKey: `supporter-register-ip:${ipKeySuffix}`,
      getPriorAttempts: () => [],
      recordAttempt: () => {},
      findByEmail: async (email) =>
        existingStatus === null ? null : { id: 'reg-victim', status: existingStatus },
      getLastConfirmationSentAt: (email) => (email === EMAIL ? sentAt : null),
      recordConfirmationSent: (email, at) => {
        if (email === EMAIL) sentAt = at;
      },
      write: async (doc) => {
        writeCalls.push(doc);
        return { id: 'reg-victim' };
      },
      refreshConsent: async (id, consentTimestamp) => {
        refreshCalls.push({ id, consentTimestamp });
      },
      mintConfirmToken: (registrationId) => ({ token: `token-for-${registrationId}`, expiresAt: T0 }),
      sendConfirmationEmail: async (input) => {
        emailCalls.push(input);
      },
      onEmailError: () => {},
    },
    emailCalls,
    writeCalls,
    refreshCalls,
    getSentAt: () => sentAt,
  };
}

const PAYLOAD = { email: EMAIL, firstName: 'Victim', consentMarketing: true };

// (1) Brand-new registration — email sent once, cooldown recorded.
const first = makeDeps({ existingStatus: null, lastConfirmationSentAt: null, ipKeySuffix: 'a' });
const r1 = await handleSupporterRegistration(PAYLOAD, first.deps);
if (!r1.body.success) failures.push(`(1) brand-new registration should succeed, got ${JSON.stringify(r1.body)}.`);
if (first.emailCalls.length !== 1) failures.push(`(1) expected exactly 1 confirmation email sent, got ${first.emailCalls.length}.`);

// (2) The SAME email resubmitted immediately (same instant T0, i.e. well inside the cooldown
// window) while still 'pending' — must NOT send a second email, and must NOT call write again
// (it's a resend of an existing pending registration, not a new document).
const second = makeDeps({ existingStatus: 'pending', lastConfirmationSentAt: T0, ipKeySuffix: 'b' });
const r2 = await handleSupporterRegistration(PAYLOAD, second.deps);
if (!r2.body.success) failures.push(`(2) cooldown-suppressed resubmission should still report success (no enumeration), got ${JSON.stringify(r2.body)}.`);
if (second.emailCalls.length !== 0) {
  failures.push(`(2) expected 0 confirmation emails sent within the cooldown window, got ${second.emailCalls.length} — the mail-bomb defense is not suppressing the resend.`);
}
if (second.writeCalls.length !== 0) {
  failures.push(`(2) expected deps.write NOT to be called for a resubmission of an existing pending registration, got ${second.writeCalls.length} call(s).`);
}

// (3) Same scenario, but lastConfirmationSentAt is EXACTLY at the cooldown boundary in the
// past (now - lastSentAt === COOLDOWN_MS) — must be allowed again (>=, not >).
const boundaryTime = new Date(T0.getTime() + SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS);
const third = makeDeps({ existingStatus: 'pending', lastConfirmationSentAt: T0, ipKeySuffix: 'c' });
third.deps.now = boundaryTime;
const r3 = await handleSupporterRegistration(PAYLOAD, third.deps);
if (!r3.body.success) failures.push(`(3) resubmission at the cooldown boundary should succeed, got ${JSON.stringify(r3.body)}.`);
if (third.emailCalls.length !== 1) {
  failures.push(`(3) expected exactly 1 confirmation email sent once the cooldown has fully elapsed, got ${third.emailCalls.length}.`);
}
if (third.refreshCalls.length !== 1) {
  failures.push(`(3) expected refreshConsent to be called exactly once for the allowed resend, got ${third.refreshCalls.length}.`);
}

// (4) An already-CONFIRMED email resubmitted — never sends any email regardless of cooldown
// state, and never calls write or refreshConsent (confirmed records are final for this route).
const fourth = makeDeps({ existingStatus: 'confirmed', lastConfirmationSentAt: null, ipKeySuffix: 'd' });
const r4 = await handleSupporterRegistration(PAYLOAD, fourth.deps);
if (!r4.body.success) failures.push(`(4) resubmission of a confirmed email should still report success, got ${JSON.stringify(r4.body)}.`);
if (fourth.emailCalls.length !== 0) failures.push(`(4) expected 0 emails for an already-confirmed email, got ${fourth.emailCalls.length}.`);
if (fourth.writeCalls.length !== 0) failures.push(`(4) expected 0 writes for an already-confirmed email, got ${fourth.writeCalls.length}.`);
if (fourth.refreshCalls.length !== 0) failures.push(`(4) expected 0 refreshConsent calls for an already-confirmed email, got ${fourth.refreshCalls.length}.`);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the per-email confirmation-send cooldown suppresses a resend of a pending ' +
    'registration within the cooldown window (0 emails, 0 writes, success response unchanged), ' +
    'allows it again once the cooldown has elapsed (>= boundary), and an already-confirmed ' +
    'email never triggers a write, refresh, or email regardless of cooldown state — all proven ' +
    'with a FRESH IP key per call, isolating this from the separate IP rate limiter.',
);
process.exit(0);
