#!/usr/bin/env node
// F6 (ticketing-foundation) — design constraint 7: rate limiting on the resend endpoint is a
// real decision function, pure and offline-testable, with injected time and injected counter
// state (no live store, no Date.now()). Proves three things the brief names explicitly:
//   1. The limit actually triggers (a 6th attempt within the window is refused).
//   2. It is keyed so one email/IP cannot exhaust another's budget.
//   3. The window genuinely rolls — an exhausted key becomes allowed again once its attempts
//      age out, rather than locking out forever.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f6-recovery-token/check-rate-limit-trigger-and-keying.mjs

import {
  decideRateLimit,
  RESEND_RATE_LIMIT_MAX_ATTEMPTS,
  RESEND_RATE_LIMIT_WINDOW_MS,
} from '../../../lib/resend-rate-limit.ts';

const failures = [];
const NOW = new Date('2027-03-01T12:00:00.000Z');
const KEY_A = 'email:buyer-a@example.com';
const KEY_B = 'email:buyer-b@example.com';
const KEY_IP = 'ip:203.0.113.7';

function attemptsAt(key, count, msBeforeNow) {
  return Array.from({ length: count }, () => ({ key, at: new Date(NOW.getTime() - msBeforeNow) }));
}

// (1) The limit triggers: with MAX_ATTEMPTS-1 prior attempts (all well within the window), the
// next check is still allowed (this would be the final permitted attempt); with MAX_ATTEMPTS
// prior attempts, the next check (the one PAST the limit) is refused.
{
  const oneUnderLimit = decideRateLimit({
    key: KEY_A,
    now: NOW,
    priorAttempts: attemptsAt(KEY_A, RESEND_RATE_LIMIT_MAX_ATTEMPTS - 1, 60 * 1000),
  });
  if (oneUnderLimit.allowed !== true) {
    failures.push(`(1a) With ${RESEND_RATE_LIMIT_MAX_ATTEMPTS - 1} prior attempts (one under the limit), decideRateLimit() returned allowed=false, expected true.`);
  }

  const atLimit = decideRateLimit({
    key: KEY_A,
    now: NOW,
    priorAttempts: attemptsAt(KEY_A, RESEND_RATE_LIMIT_MAX_ATTEMPTS, 60 * 1000),
  });
  if (atLimit.allowed !== false) {
    failures.push(`(1b) With ${RESEND_RATE_LIMIT_MAX_ATTEMPTS} prior attempts (at the limit), decideRateLimit() returned allowed=true, expected false — the limit did not actually trigger.`);
  }
  if (atLimit.allowed === false && (atLimit.retryAfterMs === null || atLimit.retryAfterMs <= 0)) {
    failures.push(`(1c) A refused decision returned retryAfterMs=${atLimit.retryAfterMs}, expected a positive number.`);
  }
}

// (2) Keying: KEY_A exhausted (MAX_ATTEMPTS prior attempts) must not affect KEY_B or an
// IP-keyed budget checked against the exact same priorAttempts array — the function must filter
// by key, not merely by count.
{
  const exhaustedForA = attemptsAt(KEY_A, RESEND_RATE_LIMIT_MAX_ATTEMPTS, 60 * 1000);

  const decisionForB = decideRateLimit({ key: KEY_B, now: NOW, priorAttempts: exhaustedForA });
  if (decisionForB.allowed !== true || decisionForB.attemptsInWindow !== 0) {
    failures.push(`(2a) A different email key (KEY_B) was affected by KEY_A's exhausted attempts: allowed=${decisionForB.allowed}, attemptsInWindow=${decisionForB.attemptsInWindow}, expected allowed=true, attemptsInWindow=0.`);
  }

  const decisionForIp = decideRateLimit({ key: KEY_IP, now: NOW, priorAttempts: exhaustedForA });
  if (decisionForIp.allowed !== true || decisionForIp.attemptsInWindow !== 0) {
    failures.push(`(2b) A differently-namespaced IP key was affected by an exhausted email key's attempts: allowed=${decisionForIp.allowed}, attemptsInWindow=${decisionForIp.attemptsInWindow}, expected allowed=true, attemptsInWindow=0.`);
  }

  // Mixed-key history: KEY_A exhausted AND KEY_B has 2 attempts, in the same priorAttempts
  // array — KEY_A's check must count only its own 5, KEY_B's check must count only its own 2.
  const mixed = [...attemptsAt(KEY_A, RESEND_RATE_LIMIT_MAX_ATTEMPTS, 60 * 1000), ...attemptsAt(KEY_B, 2, 60 * 1000)];
  const decisionForAInMixed = decideRateLimit({ key: KEY_A, now: NOW, priorAttempts: mixed });
  const decisionForBInMixed = decideRateLimit({ key: KEY_B, now: NOW, priorAttempts: mixed });
  if (decisionForAInMixed.attemptsInWindow !== RESEND_RATE_LIMIT_MAX_ATTEMPTS) {
    failures.push(`(2c) In a mixed-key history, KEY_A's attemptsInWindow was ${decisionForAInMixed.attemptsInWindow}, expected ${RESEND_RATE_LIMIT_MAX_ATTEMPTS} (KEY_B's attempts must not be counted).`);
  }
  if (decisionForBInMixed.attemptsInWindow !== 2) {
    failures.push(`(2d) In a mixed-key history, KEY_B's attemptsInWindow was ${decisionForBInMixed.attemptsInWindow}, expected 2 (KEY_A's attempts must not be counted).`);
  }
}

// (3) The window rolls: a key whose ONLY prior attempts are all older than the window is fully
// allowed again — the limit does not lock a key out forever once exhausted.
{
  const agedOut = attemptsAt(KEY_A, RESEND_RATE_LIMIT_MAX_ATTEMPTS, RESEND_RATE_LIMIT_WINDOW_MS + 1000);
  const decision = decideRateLimit({ key: KEY_A, now: NOW, priorAttempts: agedOut });
  if (decision.allowed !== true || decision.attemptsInWindow !== 0) {
    failures.push(`(3a) After the window elapsed, a previously-exhausted key was still refused (allowed=${decision.allowed}, attemptsInWindow=${decision.attemptsInWindow}) — the window is not rolling, it locks out forever.`);
  }

  // A partial roll: some attempts inside the window, some outside — only the in-window ones
  // count, proving this is a genuine sliding window, not a fixed bucket that resets all-at-once
  // on an arbitrary clock boundary.
  const partial = [
    ...attemptsAt(KEY_A, 2, RESEND_RATE_LIMIT_WINDOW_MS + 1000), // outside the window
    ...attemptsAt(KEY_A, 3, 60 * 1000), // inside the window
  ];
  const partialDecision = decideRateLimit({ key: KEY_A, now: NOW, priorAttempts: partial });
  if (partialDecision.attemptsInWindow !== 3) {
    failures.push(`(3b) With 2 attempts outside the window and 3 inside it, attemptsInWindow was ${partialDecision.attemptsInWindow}, expected 3 — attempts must age out individually, not all-or-nothing.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: decideRateLimit() triggers correctly at the configured limit with a positive ' +
    "retryAfterMs, is genuinely keyed (one email/IP's exhaustion never drains another's " +
    "budget, even sharing the same priorAttempts array), and the window rolls — a key's " +
    'attempts age out individually and a fully-aged-out key is allowed again.',
);
process.exit(0);
