import type { RateLimitAttempt } from './newsletter-rate-limit';

/**
 * Per-instance in-memory attempt history for the newsletter routes. Same known limitation as
 * the vendor routes: each server instance counts on its own, and a restart clears it.
 */

const MAX_TRACKED_KEYS = 10_000;

export interface AttemptStore {
  getPriorAttempts(key: string): RateLimitAttempt[];
  recordAttempt(key: string, at: Date): void;
}

export function createAttemptStore(windowMs: number): AttemptStore {
  const attemptsByKey = new Map<string, RateLimitAttempt[]>();

  function live(attempts: RateLimitAttempt[], now: number): RateLimitAttempt[] {
    return attempts.filter((attempt) => now - attempt.at.getTime() < windowMs);
  }

  return {
    getPriorAttempts: (key) => attemptsByKey.get(key) ?? [],
    recordAttempt: (key, at) => {
      const now = at.getTime();
      attemptsByKey.set(key, [...live(attemptsByKey.get(key) ?? [], now), { key, at }]);
      if (attemptsByKey.size <= MAX_TRACKED_KEYS) return;
      for (const [trackedKey, attempts] of attemptsByKey) {
        if (live(attempts, now).length === 0) attemptsByKey.delete(trackedKey);
      }
    },
  };
}

/**
 * Wraps a store for ONE request. Firestore re-runs transaction callbacks on contention, and the
 * handler calls getPriorAttempts/recordAttempt each time it runs; this snapshots the history on
 * first read and records at most once, so a retried callback cannot count the request twice.
 */
export function scopeAttemptsToRequest(store: AttemptStore): AttemptStore {
  const snapshots = new Map<string, RateLimitAttempt[]>();
  const recorded = new Set<string>();
  return {
    getPriorAttempts: (key) => {
      const cached = snapshots.get(key);
      if (cached) return cached;
      const fresh = store.getPriorAttempts(key);
      snapshots.set(key, fresh);
      return fresh;
    },
    recordAttempt: (key, at) => {
      if (recorded.has(key)) return;
      recorded.add(key);
      store.recordAttempt(key, at);
    },
  };
}

/**
 * Rate-limit key from the TRUSTED hop of x-forwarded-for: the LAST entry. Every proxy appends
 * the address it received the connection from, so the first entry is whatever the client chose
 * to send and can be spoofed to dodge the limit. The last entry is appended by Google's
 * front end in front of App Hosting and cannot be forged by the client. If extra trusted
 * proxies ever sit behind it, clients would share one key (over-limiting), never bypass it.
 */
export function rateLimitKeyFromHeaders(headers: Headers, scope: string): string {
  const hops = headers.get('x-forwarded-for')?.split(',') ?? [];
  const hop = hops[hops.length - 1]?.trim();
  return `${scope}:${hop || 'unknown'}`;
}
