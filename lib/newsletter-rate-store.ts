import type { RateLimitAttempt } from './newsletter-rate-limit';

// Per-instance in-memory attempt history for the newsletter routes. Same known limitation as
// the vendor routes: each server instance counts on its own, and a restart clears it.

export const MAX_TRACKED_KEYS = 10_000;
// Above the highest per-key limit of the form routes (10), so trimming never lowers a key's
// in-window count below it. Routes with a higher cap pass their own maxAttemptsPerKey.
const DEFAULT_MAX_ATTEMPTS_PER_KEY = 50;
// Expired head entries removed per record call, so one request never walks the whole map; the
// rest drain over later requests.
export const MAX_PRUNE_PER_RECORD = 64;

export interface AttemptStore {
  getPriorAttempts(key: string): RateLimitAttempt[];
  recordAttempt(key: string, at: Date): void;
}

// The Map is kept in last-activity order (a key is deleted and re-inserted on every attempt), so
// its first entry is always the least recently active key. Each record then does bounded work:
// drop up to MAX_PRUNE_PER_RECORD head entries whose newest attempt has aged out of the window,
// then evict from the head while over `maxKeys`. Each insert adds at most one key, so the map is
// at most one over the cap and the over-cap loop runs once. No full scan ever runs.
//
// Evicting the oldest-active key (rather than refusing new keys) is deliberate. Refusing new keys
// under pressure would let a flood of throwaway addresses lock every real visitor out. Evicting
// costs the attacker nothing they did not already have, since each address is limited on its own
// counter, and it only resets the counter of the key idle longest; resetting that counter takes
// `maxKeys` other distinct addresses, each of which spends its own allowance.
export function createAttemptStore(
  windowMs: number,
  maxKeys = MAX_TRACKED_KEYS,
  maxAttemptsPerKey = DEFAULT_MAX_ATTEMPTS_PER_KEY,
): AttemptStore {
  const attemptsByKey = new Map<string, RateLimitAttempt[]>();

  function newestAt(attempts: RateLimitAttempt[]): number {
    return attempts[attempts.length - 1]?.at.getTime() ?? 0;
  }

  function evictFromHead(now: number): void {
    let pruned = 0;
    for (const [trackedKey, attempts] of attemptsByKey) {
      const overCap = attemptsByKey.size > maxKeys;
      const expired = now - newestAt(attempts) >= windowMs;
      if (overCap) {
        attemptsByKey.delete(trackedKey);
      } else if (expired && pruned < MAX_PRUNE_PER_RECORD) {
        attemptsByKey.delete(trackedKey);
        pruned++;
      } else {
        return;
      }
    }
  }

  return {
    getPriorAttempts: (key) => attemptsByKey.get(key) ?? [],
    recordAttempt: (key, at) => {
      const now = at.getTime();
      const kept = (attemptsByKey.get(key) ?? []).filter(
        (attempt) => now - attempt.at.getTime() < windowMs,
      );
      attemptsByKey.delete(key);
      attemptsByKey.set(key, [...kept, { key, at }].slice(-maxAttemptsPerKey));
      evictFromHead(now);
    },
  };
}

// Wraps a store for ONE request. Firestore re-runs transaction callbacks on contention, and the
// handler calls getPriorAttempts/recordAttempt each time it runs; this snapshots the history on
// first read and records at most once, so a retried callback cannot count the request twice.
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
