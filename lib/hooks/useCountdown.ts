'use client';

import { useMemo, useSyncExternalStore } from 'react';

export interface CountdownParts {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

const ZERO: CountdownParts = {
  days: '00',
  hours: '00',
  minutes: '00',
  seconds: '00',
};

const TICK_MS = 1000;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function compute(targetMs: number): CountdownParts {
  const total = targetMs - Date.now();
  if (total <= 0) return ZERO;
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return {
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
  };
}

// The server has no meaningful "now" to render a countdown against, so it
// always renders this frozen placeholder. useSyncExternalStore guarantees the
// client's first paint matches it exactly (no hydration mismatch), then
// re-renders once mounted with the real, ticking value.
function getServerSnapshot(): CountdownParts {
  return ZERO;
}

// A tiny external store, one per target timestamp: it owns the interval and a
// cached snapshot so getSnapshot() returns a stable reference between ticks
// (required by useSyncExternalStore to avoid needless re-renders).
function createCountdownStore(targetMs: number) {
  let snapshot = compute(targetMs);
  const listeners = new Set<() => void>();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function subscribe(onStoreChange: () => void) {
    listeners.add(onStoreChange);
    if (intervalId === null) {
      intervalId = setInterval(() => {
        snapshot = compute(targetMs);
        listeners.forEach((listener) => listener());
      }, TICK_MS);
    }
    return () => {
      listeners.delete(onStoreChange);
      if (listeners.size === 0 && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }

  function getSnapshot() {
    return snapshot;
  }

  return { subscribe, getSnapshot };
}

/**
 * useCountdown
 *
 * Returns the remaining time until `targetDate` as zero-padded 2-digit strings.
 * Updates every 1000ms. When the target is reached or passed, returns all "00".
 *
 * Example:
 *   const { days, hours, minutes, seconds } = useCountdown(
 *     new Date('2027-09-18T09:00:00+02:00')
 *   );
 */
export function useCountdown(targetDate: Date): CountdownParts {
  // Keyed on the target's numeric timestamp, not the Date object's identity,
  // so a caller that passes a fresh `new Date(...)` each render (same value,
  // new identity) doesn't tear down and recreate the interval every render.
  const targetMs = targetDate.getTime();
  const { subscribe, getSnapshot } = useMemo(() => createCountdownStore(targetMs), [targetMs]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
