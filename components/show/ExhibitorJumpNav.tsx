// =============================================================
// NOS — components/show/ExhibitorJumpNav.tsx
// Server Component — "On this page" for the exhibitor guide (R34). From 768px a wrapping
// row of the shared R52 chips; below 768px the same chips inside a native <details>, so
// the long page stays short on a phone and the disclosure works without JavaScript.
// =============================================================

import { ShowJumpChips, type ShowJumpChip } from './ShowJumpChips';

const LABEL = 'On this page';

export interface ExhibitorJumpNavProps {
  items: ShowJumpChip[];
}

export function ExhibitorJumpNav({ items }: ExhibitorJumpNavProps) {
  if (items.length === 0) return null;

  return (
    <>
      <ShowJumpChips label={LABEL} items={items} className="mb-10 hidden md:block" />

      <details className="mb-10 md:hidden">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 border-b border-rule font-sans text-[length:var(--fs-body,1rem)] font-semibold leading-[1.55] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)] [&::-webkit-details-marker]:hidden">
          {LABEL}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 motion-safe:transition-transform [details[open]_&]:rotate-180"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </summary>
        <div className="pt-4">
          <ShowJumpChips label={LABEL} items={items} className="mb-0" />
        </div>
      </details>
    </>
  );
}
