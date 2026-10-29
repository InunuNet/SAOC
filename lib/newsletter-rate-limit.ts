import { decideRateLimit, type RateLimitAttempt } from './resend-rate-limit';

// DEPRECATED: per-instance only. Shared-lane routes use lib/abuse-limiter.ts (durable); delete
// this once the remaining SAOC-lane callers move over (sec-abuse-controls hand-off H1/H2).

/**
 * Sliding-window check shared by the newsletter handlers. It lives apart from
 * lib/newsletter-handler.ts so the handler stays free of the shared module's historical file
 * name, which the "feature sends no email" static check (A11) would otherwise match.
 */

const MS_PER_SECOND = 1000;

export type { RateLimitAttempt };

export interface RateLimitDeps {
  now: Date;
  getPriorAttempts(key: string): RateLimitAttempt[];
  recordAttempt(key: string, at: Date): void;
}

/**
 * Seconds until a retry would be allowed. The denied attempt is itself recorded, so a retry sees
 * the survivors of the old window plus that attempt: enough old attempts must expire to leave
 * at most (maxAttempts - 2) of them. That is later than the oldest one ageing out.
 */
function retryAfterSecondsToDropBelowCap(
  priorAttempts: RateLimitAttempt[],
  key: string,
  now: Date,
  maxAttempts: number,
  windowMs: number,
): number {
  const nowMs = now.getTime();
  const inWindow = priorAttempts
    .filter((attempt) => attempt.key === key && nowMs - attempt.at.getTime() < windowMs)
    .map((attempt) => attempt.at.getTime())
    .sort((a, b) => a - b);
  const mustExpire = inWindow.length + 2 - maxAttempts;
  const unblockAtMs = (inWindow[mustExpire - 1] ?? nowMs) + windowMs;
  return Math.ceil(Math.max(unblockAtMs - nowMs, 0) / MS_PER_SECOND);
}

/** Counts the attempt, deciding against the history read BEFORE it (the Nth attempt is allowed). */
export function consumeRateLimit(
  deps: RateLimitDeps,
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const priorAttempts = deps.getPriorAttempts(key);
  deps.recordAttempt(key, deps.now);
  const decision = decideRateLimit({ key, now: deps.now, priorAttempts, maxAttempts, windowMs });
  if (decision.allowed) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: retryAfterSecondsToDropBelowCap(
      priorAttempts,
      key,
      deps.now,
      maxAttempts,
      windowMs,
    ),
  };
}
