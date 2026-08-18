/**
 * Rate-limit decision wrapper for POST /api/vendors/register (mission vendor-registration F5).
 * See contracts/golden/vendor-f5-register-route/README.md for the full decision record and
 * every judgement call.
 *
 * Deliberately thin: `decideVendorRegistrationRateLimit` delegates to the REAL
 * `decideRateLimit()` (lib/resend-rate-limit.ts, F6/ticketing-foundation) with vendor-specific
 * `maxAttempts`/`windowMs` overrides -- no sliding-window arithmetic is reimplemented here, and
 * these constants are NOT the same as RESEND_RATE_LIMIT_MAX_ATTEMPTS/RESEND_RATE_LIMIT_WINDOW_MS
 * (those are tuned for a resend-my-tickets flow, not a one-shot public registration form).
 */

import { decideRateLimit, type RateLimitDecision } from '@/lib/resend-rate-limit';

/** Deliberately tighter than F6's resend-my-tickets 5/hour -- a vendor registration is
 *  normally a one-shot act per business, not a repeatable low-value action. Placeholder, not a
 *  Council-approved value -- see the golden README's "Judgement calls". */
export const VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS = 3;

export const VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface VendorRegistrationAttemptRecord {
  key: string;
  at: Date;
}

export function decideVendorRegistrationRateLimit(
  key: string,
  now: Date,
  priorAttempts: VendorRegistrationAttemptRecord[],
): RateLimitDecision {
  return decideRateLimit({
    key,
    now,
    priorAttempts,
    maxAttempts: VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs: VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS,
  });
}

export interface VendorRegistrationRateLimitStore {
  getPriorAttempts(key: string): VendorRegistrationAttemptRecord[];
  recordAttempt(key: string, at: Date): void;
}

/**
 * The only impure piece of this module: a module-level array wrapped in the two store
 * methods. Not persistent across cold starts or multiple Firebase App Hosting instances --
 * see the golden README's "What this contract does NOT prove".
 */
export function createInMemoryVendorRegistrationRateLimitStore(): VendorRegistrationRateLimitStore {
  const attempts: VendorRegistrationAttemptRecord[] = [];

  return {
    getPriorAttempts(key: string): VendorRegistrationAttemptRecord[] {
      return attempts.filter((attempt) => attempt.key === key);
    },
    recordAttempt(key: string, at: Date): void {
      attempts.push({ key, at });
    },
  };
}
