// =============================================================
// SAOC — components/media-kit/MediaKitJumpNav.tsx
// Server Component — sticky "On this page" for the media kit. The r23 exhibitor pattern
// (components/show/ExhibitorJumpNav.tsx) with the disclosure switched in at 699px and below: plain
// anchor chips from 700px, the same chips inside a native <details> under it, so it works without JS.
// =============================================================

import { ShowJumpChips, type ShowJumpChip } from '@/components/show/ShowJumpChips';

const LABEL = 'On this page';
// The one SAOC ring on the shared chips: 3px offset, --primary (the NOS --ring-focus default is
// 2px and undefined on SAOC). The trailing ! outranks the chip's own focus-visible outline utilities.
const CHIP_RING = 'focus-visible:outline-offset-[3px]! focus-visible:outline-primary!';

export interface MediaKitJumpNavProps {
  items: ShowJumpChip[];
}

export function MediaKitJumpNav({ items }: MediaKitJumpNavProps) {
  return (
    <div className="sticky top-[48px] z-30 bg-parchment sm:top-[80px] xl:top-[72px]">
      <ShowJumpChips label={LABEL} items={items} className="py-3 max-[699px]:hidden" linkClassName={CHIP_RING} />

      <details className="min-[700px]:hidden">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 border-b border-rule font-sans text-[length:var(--fs-body,1rem)] font-semibold leading-[1.55] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
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
        <div className="max-h-[60vh] overflow-y-auto px-2 pt-4 pb-3">
          <ShowJumpChips label={LABEL} items={items} className="mb-0" linkClassName={CHIP_RING} />
        </div>
      </details>
    </div>
  );
}
