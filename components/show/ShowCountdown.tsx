'use client';

import { useState, useSyncExternalStore } from 'react';

const TARGET_MS = new Date('2027-09-18T09:00:00+02:00').getTime();
const TICK_MS = 1_000;

interface Remain {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function compute(): Remain {
  const diff = Math.max(0, TARGET_MS - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

// The server has no meaningful "now" to render a countdown against, so it
// always renders this frozen placeholder. useSyncExternalStore guarantees the
// client's first paint matches it exactly (no hydration mismatch), then
// re-renders once mounted with the real, ticking value.
const SERVER_SNAPSHOT: Remain = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function getServerSnapshot(): Remain {
  return SERVER_SNAPSHOT;
}

// A tiny external store, one per component instance: it owns the interval
// and a cached snapshot so getSnapshot() returns a stable reference between
// ticks (required by useSyncExternalStore to avoid needless re-renders).
function createCountdownStore() {
  let snapshot = compute();
  const listeners = new Set<() => void>();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function subscribe(onStoreChange: () => void) {
    listeners.add(onStoreChange);
    if (intervalId === null) {
      intervalId = setInterval(() => {
        snapshot = compute();
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

export function ShowCountdown() {
  // Lazy initializer: the store (and its interval) is created once per
  // mounted instance, not on every render.
  const [{ subscribe, getSnapshot }] = useState(createCountdownStore);

  const remain = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const units = [
    { label: 'Days', value: remain.days },
    { label: 'Hours', value: remain.hours },
    { label: 'Min', value: remain.minutes },
    { label: 'Sec', value: remain.seconds },
  ];

  return (
    <div className="flex gap-6" aria-label="Countdown to 19th National Show">
      {units.map(({ label, value }) => (
        <div key={label} className="text-center">
          <div className="font-serif text-[42px] leading-none text-accent-soft">
            {String(value).padStart(2, '0')}
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/60">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
