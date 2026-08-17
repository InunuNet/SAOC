/**
 * Pure sliding-window rate-limit decision for the resend-my-tickets endpoint (mission
 * ticketing-foundation F6, spec §8.2). See
 * contracts/golden/ticketing-f6-recovery-token/README.md for the full decision record.
 *
 * Pure, side-effect-free — no live counter store, no database, no Date.now(). The counter state
 * is the caller-injected `priorAttempts` array, exactly like the rate-limit-relevant history a
 * real caller would read from Firestore/memory just before calling this function. `key` is an
 * opaque, caller-constructed string (e.g. `email:<address>` or `ip:<address>`) so the same
 * function serves both the email-level and IP-level limits — the real route calls this twice,
 * once per key namespace, and combines the two decisions itself (out of scope here).
 */

export const RESEND_RATE_LIMIT_MAX_ATTEMPTS = 5;

export const RESEND_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export interface RateLimitAttempt {
  key: string;
  at: Date;
}

export interface RateLimitDecision {
  allowed: boolean;
  attemptsInWindow: number;
  retryAfterMs: number | null;
}

export interface DecideRateLimitInput {
  key: string;
  now: Date;
  priorAttempts: RateLimitAttempt[];
  maxAttempts?: number;
  windowMs?: number;
}

export function decideRateLimit(input: DecideRateLimitInput): RateLimitDecision {
  const maxAttempts = input.maxAttempts ?? RESEND_RATE_LIMIT_MAX_ATTEMPTS;
  const windowMs = input.windowMs ?? RESEND_RATE_LIMIT_WINDOW_MS;
  const nowMs = input.now.getTime();

  const inWindow = input.priorAttempts.filter(
    (attempt) => attempt.key === input.key && nowMs - attempt.at.getTime() < windowMs,
  );

  const attemptsInWindow = inWindow.length;
  const allowed = attemptsInWindow < maxAttempts;

  if (allowed) {
    return { allowed, attemptsInWindow, retryAfterMs: null };
  }

  // retryAfterMs is the time until the OLDEST in-window attempt ages out of the window.
  const oldestAt = inWindow.reduce(
    (oldest, attempt) => (attempt.at.getTime() < oldest ? attempt.at.getTime() : oldest),
    Infinity,
  );
  const retryAfterMs = oldestAt + windowMs - nowMs;

  return { allowed, attemptsInWindow, retryAfterMs };
}
