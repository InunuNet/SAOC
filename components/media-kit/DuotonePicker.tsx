'use client';

// =============================================================
// SAOC — components/media-kit/DuotonePicker.tsx
// Client Component — the ink picker for the Duotone section: a radio group of six named swatches
// (arrow keys move between them natively). The selection lives in the URL hash as #duotone-<ink>,
// is restored from it on load and when it changes, and shows only that ink's 2x2 grid. Every
// ink's grid is server-rendered and passed in; this component only chooses which one is shown.
// =============================================================

import { useSyncExternalStore, type ReactNode } from 'react';

import { DEFAULT_INK, INKS, type InkId } from '@/lib/data/media-kit';

const HASH_PREFIX = '#duotone-';

export interface DuotonePickerProps {
  panels: Record<InkId, ReactNode>;
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function readHash(): string {
  return window.location.hash;
}

function serverHash(): string {
  return '';
}

function inkFromHash(hash: string): InkId {
  const match = INKS.find((ink) => hash.toLowerCase() === `${HASH_PREFIX}${ink.id}`);
  return match ? match.id : DEFAULT_INK;
}

export function DuotonePicker({ panels }: DuotonePickerProps) {
  const selected = inkFromHash(useSyncExternalStore(subscribeToHash, readHash, serverHash));

  const choose = (id: InkId) => {
    window.history.replaceState(null, '', `${HASH_PREFIX}${id}`);
    // replaceState does not fire hashchange, so tell the store the hash moved.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return (
    <div>
      <fieldset className="mb-6">
        <legend className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Ink</legend>
        <div role="radiogroup" aria-label="Ink" className="flex flex-wrap gap-3">
          {INKS.map((ink) => (
            <label key={ink.id} className="relative block cursor-pointer">
              <input
                type="radio"
                name="duotone-ink"
                value={ink.id}
                checked={selected === ink.id}
                onChange={() => choose(ink.id)}
                className="peer sr-only"
              />
              <span className="flex min-h-[44px] items-center gap-3 border border-rule bg-parchment px-3 py-2 peer-checked:border-primary peer-checked:bg-bone peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                <span
                  aria-hidden="true"
                  className="size-6 shrink-0 border border-rule"
                  style={{ backgroundColor: ink.hex }}
                />
                <span className="flex flex-col">
                  <span className="font-sans text-[14px] font-semibold leading-[1.2] text-ink">{ink.label}</span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
                    {ink.hex}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {INKS.map((ink) => (
        <div
          key={ink.id}
          data-ink={ink.id}
          className={selected === ink.id ? 'grid grid-cols-1 gap-6 md:grid-cols-2' : 'hidden'}
        >
          {panels[ink.id]}
        </div>
      ))}
    </div>
  );
}
