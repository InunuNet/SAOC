'use client';

import { useState, useSyncExternalStore } from 'react';

import { ConfirmationBadge } from './ConfirmationBadge';
import { showLabelWithEdition } from '@/lib/show-identity';

const TICK_MS = 1_000;

export interface ShowCountdownProps {
  countdownDate?: string | null;
  /** Edition number from the nationalShow singleton — never hardcoded here. */
  edition?: number | null;
  /** Pending label from showVisitorInfo, for the "no date" state. */
  pendingLabel?: string | null;
}

interface Remain {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Returns null when the dataset has no usable countdown date. There is deliberately no
// fallback date: a hardcoded ISO date here is an INVENTED date presented as a live
// ticking fact the moment an editor clears countdownDate. When a show-identity fact is
// absent we render the absence — see show-identity-surfaces.golden.md.
function resolveTargetMs(countdownDate?: string | null): number | null {
  if (!countdownDate) return null;
  const candidate = new Date(countdownDate);
  return Number.isNaN(candidate.getTime()) ? null : candidate.getTime();
}

function compute(targetMs: number): Remain {
  const diff = Math.max(0, targetMs - Date.now());
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

export function ShowCountdown({ countdownDate, edition, pendingLabel }: ShowCountdownProps) {
  const targetMs = resolveTargetMs(countdownDate);

  // Lazy initializer: the store (and its interval) is created once per
  // mounted instance, not on every render. Hooks stay unconditional — the
  // "no date" branch is taken after they have run.
  const [{ subscribe, getSnapshot }] = useState(() => createCountdownStore(targetMs ?? Date.now()));

  const remain = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const ariaLabel = `Countdown to the ${showLabelWithEdition(edition)}`;

  if (targetMs === null) {
    return (
      <div>
        <p className="font-serif text-[24px] leading-none text-accent-soft">
          Show dates to be confirmed
        </p>
        <ConfirmationBadge status="pending" pendingLabel={pendingLabel} tone="dark" />
      </div>
    );
  }

  const units = [
    { label: 'Days', value: remain.days },
    { label: 'Hours', value: remain.hours },
    { label: 'Min', value: remain.minutes },
    { label: 'Sec', value: remain.seconds },
  ];

  return (
    <div className="flex gap-6" aria-label={ariaLabel}>
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
