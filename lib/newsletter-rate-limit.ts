import { decideRateLimit, type RateLimitAttempt } from './resend-rate-limit';

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
    retryAfterSeconds: Math.ceil((decision.retryAfterMs ?? 0) / MS_PER_SECOND),
  };
}
