/**
 * Rate-limit decision wrapper for POST /api/vendors/register/verify-code (mission
 * vendor-gated-registration-flow, M4/F23). A NEW sibling module to
 * lib/vendor-registration-rate-limit.ts, not a mutation of it -- that limiter guards the
 * one-shot full registration submission; this one guards the human-readable code guessing
 * surface and needs its own key namespace and tuning (10 attempts/hour, per the M4 golden
 * README's "Verification, rate limiting, and lockout thresholds"). Deliberately thin: delegates
 * to the REAL decideRateLimit() (lib/resend-rate-limit.ts) -- no sliding-window arithmetic is
 * reimplemented here.
 *
 * This is documented as a SECONDARY, best-effort deterrent (spoofable x-forwarded-for,
 * in-memory/not cross-instance -- same caveat as lib/vendor-registration-rate-limit.ts's own).
 * The load-bearing control against guessing is the per-application lockout in
 * lib/vendor-registration-code.ts, which this limiter does not replace.
 */

import { decideRateLimit, type RateLimitDecision } from '@/lib/resend-rate-limit';

export const VENDOR_REGISTER_CODE_VERIFY_RATE_LIMIT_MAX_ATTEMPTS = 10;

export const VENDOR_REGISTER_CODE_VERIFY_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface VendorRegistrationCodeVerifyAttemptRecord {
  key: string;
  at: Date;
}

export function decideVendorRegistrationCodeVerifyRateLimit(
  key: string,
  now: Date,
  priorAttempts: VendorRegistrationCodeVerifyAttemptRecord[],
): RateLimitDecision {
  return decideRateLimit({
    key,
    now,
    priorAttempts,
    maxAttempts: VENDOR_REGISTER_CODE_VERIFY_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs: VENDOR_REGISTER_CODE_VERIFY_RATE_LIMIT_WINDOW_MS,
  });
}

export interface VendorRegistrationCodeVerifyRateLimitStore {
  getPriorAttempts(key: string): VendorRegistrationCodeVerifyAttemptRecord[];
  recordAttempt(key: string, at: Date): void;
}

/**
 * The only impure piece of this module: a module-level array wrapped in the two store
 * methods. Not persistent across cold starts or multiple Firebase App Hosting instances --
 * same documented caveat as lib/vendor-registration-rate-limit.ts's own in-memory store.
 */
export function createInMemoryVendorRegistrationCodeVerifyRateLimitStore(): VendorRegistrationCodeVerifyRateLimitStore {
  const attempts: VendorRegistrationCodeVerifyAttemptRecord[] = [];

  return {
    getPriorAttempts(key: string): VendorRegistrationCodeVerifyAttemptRecord[] {
      return attempts.filter((attempt) => attempt.key === key);
    },
    recordAttempt(key: string, at: Date): void {
      attempts.push({ key, at });
    },
  };
}
