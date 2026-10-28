'use client';

// =============================================================
// SAOC — components/media-kit/LockupPicker.tsx
// Client Component — the merged Full colour · Greyscale picker: a family toggle (two radios) and a
// variant group (four radios), with ONE visible preview card that follows both. Same chip markup and
// tokens as OptionPicker / DuotonePicker. The selection lives in the URL hash as
// #lockups-<family>-<variant>; the "On this page" anchors #full-colour and #greyscale preselect the
// family (variant defaults to the first). Every card is server-rendered and passed in; this
// component only chooses which one is shown. ONE zip link follows the family toggle: same visible
// text, href and accessible name switch with the family. It follows both radio groups in DOM order,
// so a keyboard user reaches the zip after choosing, without going back. Without JS the default family's zip is
// the link, and a <noscript> link keeps every other family's zip reachable.
// =============================================================

import { useSyncExternalStore, type ReactNode } from 'react';

import { ZIP_LABEL } from '@/components/media-kit/KitSection';

export interface LockupPickerOption {
  id: string;
  label: string;
}

export interface LockupPickerZip {
  href: string;
  /** The size line shown beside the link, e.g. "ZIP · 8.5 MB". */
  meta: string;
}

export interface LockupPickerProps {
  /** The family group's accessible name: the section's own heading words, never new copy.
   *  The variant group is named by the selected family's own chip, so it follows the toggle. */
  familyLabel: string;
  /** Radio input names, unique on the page. */
  familyName: string;
  variantName: string;
  families: ReadonlyArray<LockupPickerOption>;
  variants: ReadonlyArray<LockupPickerOption>;
  /** One card per `${familyId}/${variantId}`. */
  panels: Record<string, ReactNode>;
  /** The family's section zip, by family id. */
  zips: Record<string, LockupPickerZip>;
}

const ZIP_LINK_CLASS =
  'inline-flex min-h-[44px] items-center font-sans text-[14px] font-semibold text-ink underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary';
const ZIP_META_CLASS = 'font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted';

const HASH_PREFIX = '#lockups-';

const CHIP_CLASS =
  'relative flex min-h-[44px] items-center border border-rule bg-parchment px-3 py-2 font-sans text-[14px] leading-[1.2] text-ink peer-checked:z-10 peer-checked:border-primary peer-checked:bg-bone peer-checked:font-semibold peer-checked:shadow-[inset_0_0_0_1px_var(--primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-primary';

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

function writeHash(familyId: string, variantId: string): void {
  window.history.replaceState(null, '', `${HASH_PREFIX}${familyId}-${variantId}`);
  // replaceState does not fire hashchange, so tell the store the hash moved.
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function LockupPicker({
  familyLabel,
  familyName,
  variantName,
  families,
  variants,
  panels,
  zips,
}: LockupPickerProps) {
  const hash = useSyncExternalStore(subscribeToHash, readHash, serverHash).toLowerCase();
  let family = families[0].id;
  let variant = variants[0].id;
  for (const f of families) {
    if (hash === `#${f.id}`) family = f.id;
    for (const v of variants) {
      if (hash === `${HASH_PREFIX}${f.id}-${v.id}`) {
        family = f.id;
        variant = v.id;
      }
    }
  }

  const selectedFamily = families.find((f) => f.id === family) ?? families[0];
  const zip = zips[selectedFamily.id];

  return (
    <div>
      <div role="radiogroup" aria-label={familyLabel} className="mb-4 flex flex-wrap">
        {families.map((option) => (
          <label key={option.id} className="relative -ml-px block cursor-pointer first:ml-0">
            <input
              type="radio"
              name={familyName}
              value={option.id}
              checked={family === option.id}
              onChange={() => writeHash(option.id, variant)}
              // The already-selected radio fires no change event; a click still records its hash.
              onClick={() => writeHash(option.id, variant)}
              className="peer sr-only"
            />
            <span id={`${familyName}-${option.id}`} className={CHIP_CLASS}>
              {option.label}
            </span>
          </label>
        ))}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${familyName}-${family}`}
        className="mb-6 flex flex-wrap gap-3"
      >
        {variants.map((option) => (
          <label key={option.id} className="relative block cursor-pointer">
            <input
              type="radio"
              name={variantName}
              value={option.id}
              checked={variant === option.id}
              onChange={() => writeHash(family, option.id)}
              onClick={() => writeHash(family, option.id)}
              className="peer sr-only"
            />
            <span className={CHIP_CLASS}>{option.label}</span>
          </label>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-x-4">
        <a
          href={zip.href}
          download
          aria-label={`${ZIP_LABEL.section} — ${selectedFamily.label}`}
          className={ZIP_LINK_CLASS}
        >
          {ZIP_LABEL.section}
        </a>
        <span className={ZIP_META_CLASS}>{zip.meta}</span>
        <noscript>
          {families
            .filter((f) => f.id !== families[0].id)
            .map((f) => (
              <a
                key={f.id}
                href={zips[f.id].href}
                download
                aria-label={`${ZIP_LABEL.section} — ${f.label}`}
                className={ZIP_LINK_CLASS}
              >
                {ZIP_LABEL.section}
              </a>
            ))}
        </noscript>
      </div>
      {families.flatMap((f) =>
        variants.map((v) => {
          const key = `${f.id}/${v.id}`;
          return (
            <div
              key={key}
              data-option={key}
              className={family === f.id && variant === v.id ? 'max-w-[640px]' : 'hidden'}
            >
              {panels[key]}
            </div>
          );
        })
      )}
    </div>
  );
}
