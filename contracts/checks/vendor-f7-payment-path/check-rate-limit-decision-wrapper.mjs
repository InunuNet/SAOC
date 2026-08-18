#!/usr/bin/env node
// F7 (vendor-registration) -- A13: decideProofOfPaymentRateLimit() delegates to the REAL
// decideRateLimit() (lib/resend-rate-limit.ts, F6/ticketing-foundation) with
// proof-of-payment-specific constants (PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS = 5,
// PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS = 1 day) -- not a reimplementation of the
// sliding-window arithmetic, and not a silent alias of RESEND_RATE_LIMIT_MAX_ATTEMPTS (5,
// same number but a 1-HOUR window) or VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS (3, 1-hour
// window). Mirrors F5's check-rate-limit-decision-wrapper.mjs pattern exactly.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-rate-limit-decision-wrapper.mjs

import {
  decideProofOfPaymentRateLimit,
  PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS,
  PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS,
} from '../../../lib/vendor-payment-rate-limit.ts';

const failures = [];
const NOW = new Date('2027-01-05T12:00:00Z');
const KEY = 'vendor-proof-of-payment-ip:203.0.113.5';
const OTHER_KEY = 'vendor-proof-of-payment-ip:198.51.100.7';

function attemptsAt(key, timestamps) {
  return timestamps.map((iso) => ({ key, at: new Date(iso) }));
}

// (1) Pinned constant values.
if (PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS !== 5) {
  failures.push(`(1) PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS is ${PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS}, expected 5.`);
}
if (PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS !== 24 * 60 * 60 * 1000) {
  failures.push(`(1) PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS is ${PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS}, expected a 1-day window (${24 * 60 * 60 * 1000}ms).`);
}

// (2) The boundary is exactly at MAX_ATTEMPTS: with 5 prior attempts already recorded, a 6th
// call is refused with a non-null retryAfterMs; with only 4 prior recorded, the 5th is allowed.
{
  const fivePrior = attemptsAt(KEY, [
    '2027-01-05T01:00:00Z',
    '2027-01-05T03:00:00Z',
    '2027-01-05T05:00:00Z',
    '2027-01-05T07:00:00Z',
    '2027-01-05T09:00:00Z',
  ]);
  const sixthDecision = decideProofOfPaymentRateLimit(KEY, NOW, fivePrior);
  if (sixthDecision.allowed !== false) {
    failures.push(`(2) with 5 prior attempts already recorded, the 6th call must be refused, got allowed:${sixthDecision.allowed}.`);
  }
  if (sixthDecision.retryAfterMs === null || sixthDecision.retryAfterMs === undefined) {
    failures.push('(2) a refused decision must carry a non-null retryAfterMs.');
  }

  const fourPrior = fivePrior.slice(0, 4);
  const fifthDecision = decideProofOfPaymentRateLimit(KEY, NOW, fourPrior);
  if (fifthDecision.allowed !== true) {
    failures.push(`(2) with only 4 prior attempts recorded, the 5th call must be allowed, got allowed:${fifthDecision.allowed}.`);
  }
}

// (3) A DIFFERENT key with the identical priorAttempts array remains fully allowed.
{
  const fivePriorForKey = attemptsAt(KEY, [
    '2027-01-05T01:00:00Z',
    '2027-01-05T03:00:00Z',
    '2027-01-05T05:00:00Z',
    '2027-01-05T07:00:00Z',
    '2027-01-05T09:00:00Z',
  ]);
  const otherKeyDecision = decideProofOfPaymentRateLimit(OTHER_KEY, NOW, fivePriorForKey);
  if (otherKeyDecision.allowed !== true) {
    failures.push('(3) a different key with an identical-looking priorAttempts array (all keyed to the FIRST key) must remain allowed.');
  }
}

// (4) An attempt older than the window is excluded from the count.
{
  const agedOutAt = new Date(NOW.getTime() - PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS - 60 * 1000);
  const agedOutAttempts = Array.from({ length: 5 }, () => ({ key: KEY, at: agedOutAt }));
  const decision = decideProofOfPaymentRateLimit(KEY, NOW, agedOutAttempts);
  if (decision.allowed !== true || decision.attemptsInWindow !== 0) {
    failures.push(`(4) 5 attempts older than the window must be fully excluded, got allowed:${decision.allowed}, attemptsInWindow:${decision.attemptsInWindow}.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: decideProofOfPaymentRateLimit() enforces exactly PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS ' +
    '(5) per key within a 1-day window, is keyed, and excludes aged-out attempts.',
);
process.exit(0);
