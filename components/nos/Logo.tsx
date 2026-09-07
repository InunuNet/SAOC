// =============================================================
// NOS — components/nos/Logo.tsx
// Server Component. Layout B lockup — the approved identity (design grammar):
// the emblem above (vertical) or beside (horizontal) a single-line
// "NATIONAL ORCHID SHOW" wordmark in Cormorant Garamond, over a wide-tracked
// "WESTERN CAPE · 2027" line in Jost. The retired circular badge lockup is
// never used here, in either orientation.
// =============================================================

import { EmblemBadge } from './EmblemBadge';

export interface NosLogoProps {
  /** `on-dark` for use over the royal-purple/night ground. */
  tone?: 'light' | 'on-dark';
  /**
   * `vertical` (default, unchanged) stacks the emblem above the wordmark,
   * centred — the mark for a card or footer. `horizontal` sets the emblem
   * beside the two wordmark lines, left-aligned — the "full format" lockup
   * for a wide surface like a hero.
   */
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

// Horizontal only: the emblem's pixel size is picked so its optical height
// matches the two-line wordmark block, not hard-coded arbitrarily. Wordmark
// block height ≈ (22px title * 1.15 line-height) + 4px gap + (11px subtitle *
// 1.3 line-height) ≈ 25 + 4 + 14 = ~44px. EmblemBadge's viewBox is 1264×848
// (~1.49:1), so an emblem *width* of 66px renders at height 66 * 848/1264 ≈
// 44px — a lockup where the mark and the type disagree in height reads as
// broken, per the design grammar.
const HORIZONTAL_EMBLEM_SIZE = 66;
const VERTICAL_EMBLEM_SIZE = 56;

export function Logo({ tone = 'light', orientation = 'vertical', className = '' }: NosLogoProps) {
  const isDark = tone === 'on-dark';
  const isHorizontal = orientation === 'horizontal';

  const titleClasses = [
    'font-serif text-[22px] font-medium uppercase tracking-[0.16em]',
    isDark ? 'text-ivory' : 'text-ink',
  ].join(' ');

  const subtitleClasses = [
    'font-sans text-[11px] font-medium uppercase tracking-[0.3em]',
    isDark ? 'text-[var(--lilac-muted)]' : 'text-muted',
  ].join(' ');

  if (isHorizontal) {
    return (
      <div
        className={['flex items-center gap-4 text-left', className].filter(Boolean).join(' ')}
      >
        <EmblemBadge size={HORIZONTAL_EMBLEM_SIZE} />
        <div className="flex flex-col gap-1">
          <span className={titleClasses}>National Orchid Show</span>
          <span className={subtitleClasses}>Western Cape · 2027</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={['flex flex-col items-center gap-2 text-center', className]
        .filter(Boolean)
        .join(' ')}
    >
      <EmblemBadge size={VERTICAL_EMBLEM_SIZE} />
      <span className={titleClasses}>National Orchid Show</span>
      <span className={subtitleClasses}>Western Cape · 2027</span>
    </div>
  );
}
