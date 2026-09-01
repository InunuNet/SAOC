/**
 * Rate-limit decision wrapper for POST /api/vendors/[id]/marketing-asset (mission
 * vendor-gated-registration-flow, M2 F18). Mirrors `lib/vendor-payment-rate-limit.ts` (F7)
 * exactly: delegates to the real `decideRateLimit()` (lib/resend-rate-limit.ts) with its own
 * maxAttempts/windowMs — no sliding-window arithmetic reimplemented here.
 */

import { decideRateLimit, type RateLimitDecision } from './resend-rate-limit.ts';

export const MARKETING_ASSET_RATE_LIMIT_MAX_ATTEMPTS = 10;

export const MARKETING_ASSET_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day

export interface MarketingAssetAttemptRecord {
  key: string;
  at: Date;
}

export function decideMarketingAssetRateLimit(
  key: string,
  now: Date,
  priorAttempts: MarketingAssetAttemptRecord[],
): RateLimitDecision {
  return decideRateLimit({
    key,
    now,
    priorAttempts,
    maxAttempts: MARKETING_ASSET_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs: MARKETING_ASSET_RATE_LIMIT_WINDOW_MS,
  });
}

export interface MarketingAssetRateLimitStore {
  getPriorAttempts(key: string): MarketingAssetAttemptRecord[];
  recordAttempt(key: string, at: Date): void;
}

/** Module-level in-memory store — not persistent across cold starts or multiple Firebase App
 *  Hosting instances, mirroring F7's own documented limitation. */
export function createInMemoryMarketingAssetRateLimitStore(): MarketingAssetRateLimitStore {
  const attempts: MarketingAssetAttemptRecord[] = [];

  return {
    getPriorAttempts(key: string): MarketingAssetAttemptRecord[] {
      return attempts.filter((attempt) => attempt.key === key);
    },
    recordAttempt(key: string, at: Date): void {
      attempts.push({ key, at });
    },
  };
}
