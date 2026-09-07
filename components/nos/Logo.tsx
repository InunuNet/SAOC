// =============================================================
// NOS — components/nos/Logo.tsx
// Server Component. Layout B lockup — the approved identity (design grammar):
// the emblem above a single-line "NATIONAL ORCHID SHOW" wordmark in
// Cormorant Garamond, over a wide-tracked "WESTERN CAPE · 2027" line in
// Jost. The retired circular badge lockup is never used here.
// =============================================================

import { EmblemBadge } from './EmblemBadge';

export interface NosLogoProps {
  /** `on-dark` for use over the royal-purple/night ground. */
  tone?: 'light' | 'on-dark';
  className?: string;
}

export function Logo({ tone = 'light', className = '' }: NosLogoProps) {
  const isDark = tone === 'on-dark';

  return (
    <div
      className={['flex flex-col items-center gap-2 text-center', className]
        .filter(Boolean)
        .join(' ')}
    >
      <EmblemBadge size={56} />
      <span
        className={[
          'font-serif text-[22px] font-medium uppercase tracking-[0.16em]',
          isDark ? 'text-ivory' : 'text-ink',
        ].join(' ')}
      >
        National Orchid Show
      </span>
      <span
        className={[
          'font-sans text-[11px] font-medium uppercase tracking-[0.3em]',
          isDark ? 'text-[var(--lilac-muted)]' : 'text-muted',
        ].join(' ')}
      >
        Western Cape · 2027
      </span>
    </div>
  );
}
