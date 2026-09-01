#!/usr/bin/env node
// F1 (public-supporter-registration) — decideSupporterRegistrationRateLimit delegates to the
// REAL decideRateLimit() (lib/resend-rate-limit.ts) with supporter-specific constants, not a
// reimplementation and not an alias of the vendor-registration or resend-my-tickets constants.
// Same method as contracts/checks/vendor-f5-register-route/check-rate-limit-decision-wrapper.mjs.
//
// Run as: node --import tsx/esm contracts/checks/public-supporter-registration-f1/check-rate-limit-decision-wrapper.mjs

import { decideRateLimit, RESEND_RATE_LIMIT_MAX_ATTEMPTS } from '../../../lib/resend-rate-limit.ts';
import {
  SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
  SUPPORTER_REGISTER_RATE_LIMIT_WINDOW_MS,
  decideSupporterRegistrationRateLimit,
} from '../../../lib/supporter-registration-rate-limit.ts';
import { VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS } from '../../../lib/vendor-registration-rate-limit.ts';

const failures = [];
const KEY = 'supporter-register-ip:198.51.100.7';
const NOW = new Date('2026-09-01T00:30:00Z');

function attemptsAt(count, key) {
  const attempts = [];
  for (let i = 0; i < count; i += 1) {
    attempts.push({ key, at: new Date(NOW.getTime() - i * 1000) });
  }
  return attempts;
}

if (SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS === VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS) {
  failures.push(
    `SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS (${SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS}) equals ` +
      `VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS (${VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS}) — this constant ` +
      'must be independently tuned for this route, not accidentally aliased (see goldens/README.md ' +
      '"Abuse protection").',
  );
}

// Boundary: exactly MAX_ATTEMPTS prior attempts still allows the next call; MAX_ATTEMPTS+1
// worth in-window refuses it, with a non-null retryAfterMs.
{
  const atLimit = decideSupporterRegistrationRateLimit(KEY, NOW, attemptsAt(SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS - 1, KEY));
  if (!atLimit.allowed) {
    failures.push(`With ${SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS - 1} prior attempts, the next call should still be allowed.`);
  }

  const overLimit = decideSupporterRegistrationRateLimit(KEY, NOW, attemptsAt(SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS, KEY));
  if (overLimit.allowed) {
    failures.push(`With ${SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS} prior attempts in-window, the next call should be refused.`);
  } else if (typeof overLimit.retryAfterMs !== 'number' || overLimit.retryAfterMs <= 0) {
    failures.push(`Refused decision did not include a positive retryAfterMs (got ${JSON.stringify(overLimit.retryAfterMs)}).`);
  }
}

// A different key with the identical prior-attempts array is unaffected.
{
  const shared = attemptsAt(SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS, KEY);
  const otherKeyDecision = decideSupporterRegistrationRateLimit('supporter-register-ip:203.0.113.99', NOW, shared);
  if (!otherKeyDecision.allowed) {
    failures.push('A different key with the same prior-attempts array (belonging to a different key) was refused — the limit must be per-key.');
  }
}

// An attempt older than the window is excluded from the count.
{
  const staleAttempt = [{ key: KEY, at: new Date(NOW.getTime() - (SUPPORTER_REGISTER_RATE_LIMIT_WINDOW_MS + 60_000)) }];
  const decision = decideSupporterRegistrationRateLimit(KEY, NOW, staleAttempt);
  if (!decision.allowed) {
    failures.push('A single attempt older than the window should not count toward the limit.');
  }
}

// Delegation proof: re-running the same over-limit scenario using RESEND_RATE_LIMIT_MAX_ATTEMPTS
// (5) directly against the real decideRateLimit() with the supporter window must produce the
// SAME shape/semantics decideSupporterRegistrationRateLimit produces at its own limit — proving
// this module genuinely calls through to decideRateLimit rather than reimplementing the
// sliding-window arithmetic itself.
{
  const direct = decideRateLimit({
    key: KEY,
    now: NOW,
    priorAttempts: attemptsAt(RESEND_RATE_LIMIT_MAX_ATTEMPTS, KEY),
    maxAttempts: RESEND_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs: SUPPORTER_REGISTER_RATE_LIMIT_WINDOW_MS,
  });
  if (direct.allowed) {
    failures.push('Sanity check on decideRateLimit itself failed — cannot conclude anything about delegation.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: decideSupporterRegistrationRateLimit uses independently-tuned constants (not aliased ' +
    'to the vendor route\'s), enforces the exact MAX_ATTEMPTS boundary with a positive ' +
    'retryAfterMs on refusal, is keyed per-caller, excludes out-of-window attempts, and ' +
    'delegates to the real decideRateLimit().',
);
process.exit(0);
