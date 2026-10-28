'use client';

// =============================================================
// SAOC — components/media-kit/OptionPicker.tsx
// Client Component — a text-only radio group that shows one option's panel at a time. Same markup and
// tokens as DuotonePicker minus the swatch (these options have no swatch colour to show; the preview
// is the swatch). The selection lives in the URL hash as #<hashPrefix>-<id>, is restored from it on
// load and when it changes. Every panel is server-rendered and passed in; this component only
// chooses which one is shown. The selected chip carries bold weight and a ring, never colour alone.
// =============================================================

import { useSyncExternalStore, type ReactNode } from 'react';

export interface OptionPickerOption {
  id: string;
  label: string;
}

export interface OptionPickerProps {
  /** The group's accessible name: the section's own heading words, never new copy. */
  label: string;
  /** Radio input name, unique per picker on the page. */
  name: string;
  hashPrefix: string;
  defaultId: string;
  options: ReadonlyArray<OptionPickerOption>;
  panels: Record<string, ReactNode>;
  /** Grid classes for the visible panel. */
  panelClassName: string;
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

export function OptionPicker({
  label,
  name,
  hashPrefix,
  defaultId,
  options,
  panels,
  panelClassName,
}: OptionPickerProps) {
  const hash = useSyncExternalStore(subscribeToHash, readHash, serverHash).toLowerCase();
  const fromHash = options.find((option) => hash === `#${hashPrefix}-${option.id}`);
  const selected = fromHash ? fromHash.id : defaultId;

  const choose = (id: string) => {
    window.history.replaceState(null, '', `#${hashPrefix}-${id}`);
    // replaceState does not fire hashchange, so tell the store the hash moved.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return (
    <div>
      <div role="radiogroup" aria-label={label} className="mb-6 flex flex-wrap gap-3">
        {options.map((option) => (
          <label key={option.id} className="relative block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={selected === option.id}
              onChange={() => choose(option.id)}
              // The already-selected radio fires no change event; a click still records its hash.
              onClick={() => choose(option.id)}
              className="peer sr-only"
            />
            <span className="flex min-h-[44px] items-center border border-rule bg-parchment px-3 py-2 font-sans text-[14px] leading-[1.2] text-ink peer-checked:border-primary peer-checked:bg-bone peer-checked:font-semibold peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {options.map((option) => (
        <div
          key={option.id}
          data-option={option.id}
          className={selected === option.id ? panelClassName : 'hidden'}
        >
          {panels[option.id]}
        </div>
      ))}
    </div>
  );
}
