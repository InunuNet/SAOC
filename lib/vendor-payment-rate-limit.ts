/**
 * Rate-limit decision wrapper for POST /api/vendors/[id]/proof-of-payment (mission
 * vendor-registration F7). See contracts/golden/vendor-f7-payment-path/README.md for the full
 * decision record and every judgement call.
 *
 * Deliberately thin: `decideProofOfPaymentRateLimit` delegates to the REAL
 * `decideRateLimit()` (lib/resend-rate-limit.ts) with proof-of-payment-specific
 * `maxAttempts`/`windowMs` overrides — no sliding-window arithmetic is reimplemented here, and
 * these constants are NOT a silent alias of RESEND_RATE_LIMIT_MAX_ATTEMPTS/
 * VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS (both 1-hour windows) — this window is a full day,
 * deliberately tighter over the relevant time horizon than either, since this is the single
 * most expensive unauthenticated action in this mission (a 5 MB Storage write). Mirrors
 * lib/vendor-registration-rate-limit.ts (F5) exactly.
 */

import { decideRateLimit, type RateLimitDecision } from '@/lib/resend-rate-limit';

export const PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS = 5;

export const PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day

export interface ProofOfPaymentAttemptRecord {
  key: string;
  at: Date;
}

export function decideProofOfPaymentRateLimit(
  key: string,
  now: Date,
  priorAttempts: ProofOfPaymentAttemptRecord[],
): RateLimitDecision {
  return decideRateLimit({
    key,
    now,
    priorAttempts,
    maxAttempts: PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs: PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS,
  });
}

export interface ProofOfPaymentRateLimitStore {
  getPriorAttempts(key: string): ProofOfPaymentAttemptRecord[];
  recordAttempt(key: string, at: Date): void;
}

/**
 * The only impure piece of this module: a module-level array wrapped in the two store
 * methods. Not persistent across cold starts or multiple Firebase App Hosting instances —
 * see the golden README's "What this contract does NOT prove".
 */
export function createInMemoryProofOfPaymentRateLimitStore(): ProofOfPaymentRateLimitStore {
  const attempts: ProofOfPaymentAttemptRecord[] = [];

  return {
    getPriorAttempts(key: string): ProofOfPaymentAttemptRecord[] {
      return attempts.filter((attempt) => attempt.key === key);
    },
    recordAttempt(key: string, at: Date): void {
      attempts.push({ key, at });
    },
  };
}
