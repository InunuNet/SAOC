// =============================================================
// NOS — components/nos/Logo.tsx
// Server Component. Layout B lockup — the approved identity (design grammar):
// the emblem above (vertical) or beside (horizontal) a single-line
// "NATIONAL ORCHID SHOW" wordmark in Cormorant Garamond, over a wide-tracked
// "WESTERN CAPE · 2027" line in Jost. The retired circular badge lockup is
// never used here, in any orientation.
//
// The lockup is a mark, never a headline. It once carried a `size="hero"`
// scale and an `as="h1"` escape hatch so it could stand in for the flagship
// hero's `<h1>`; F21 moved that job to a real `<h1>` inside NosHero (the show's
// name as text at `--display-xl`), leaving the lockup to the masthead and
// colophon. Both props and their five derived hero constants are gone with it —
// a lockup nested in a heading was the thing the grammar objected to, so do not
// reintroduce them: give the surface its own `<h1>` and place the mark beside it.
// =============================================================

import { EmblemBadge } from './EmblemBadge';

export interface NosLogoProps {
  /** `on-dark` for use over the royal-purple/night ground. */
  tone?: 'light' | 'on-dark';
  /**
   * `vertical` (default) stacks the emblem above the wordmark, centred — the
   * mark for a card or footer. `horizontal` sets the emblem beside the two
   * wordmark lines, left-aligned — the "full format" lockup for a wide surface
   * like a masthead. `responsive` stacks below `xl` and goes inline from `xl`
   * up, rendered as a single element rather than two CSS-hidden instances. It
   * is left-aligned at both breakpoints, so it sits flush with the column
   * beneath it; only the standalone `vertical` mark is centred.
   */
  orientation?: 'vertical' | 'horizontal' | 'responsive';
  className?: string;
}

// Horizontal: the emblem's pixel size is picked so its optical height matches
// the two-line wordmark block, not hard-coded arbitrarily. Wordmark block
// height ≈ (22px title * 1.15 line-height) + 4px gap + (11px subtitle * 1.3
// line-height) ≈ 25 + 4 + 14 = ~44px. EmblemBadge's viewBox is 1264×848
// (~1.49:1), so an emblem *width* of 66px renders at height 66 * 848/1264 ≈
// 44px — a lockup where the mark and the type disagree in height reads as
// broken, per the design grammar.
const HORIZONTAL_EMBLEM_SIZE = 66;
const VERTICAL_EMBLEM_SIZE = 56;

export function Logo({ tone = 'light', orientation = 'vertical', className = '' }: NosLogoProps) {
  const isDark = tone === 'on-dark';

  const titleClasses = [
    'font-serif font-medium uppercase text-[22px] tracking-[0.16em]',
    isDark ? 'text-ivory' : 'text-ink',
  ].join(' ');

  const subtitleClasses = [
    'font-sans font-medium uppercase text-[11px] tracking-[0.3em]',
    // lilac-muted holds on the flat dark ground the compact lockup is used on
    // (masthead/colophon/nav/footer). It is NOT cleared for use over full-bleed
    // photography — measured there at 3.35:1 on orchid-violet.jpg and 3.76:1 on
    // orchid-yellow.jpg, below 4.5:1. A photographic ground needs pale ivory,
    // same as the eyebrow/edition/countdown fixes in NosHero.tsx.
    isDark ? 'text-[var(--lilac-muted)]' : 'text-muted',
  ].join(' ');

  // A <span> wrapper, not a <div>: the lockup is routinely placed inside
  // phrasing-only containers (a link, a caption), where a <div> is invalid.
  // `flex flex-col` gives it the same stacking a div had.
  const wordmark = (
    <span className="flex flex-col gap-1">
      <span className={titleClasses}>National Orchid Show</span>
      <span className={subtitleClasses}>Western Cape · 2027</span>
    </span>
  );

  if (orientation === 'responsive') {
    // One wordmark — never two swapped instances, which would duplicate the
    // mark's text for a screen reader. Only the layout switches, at `xl`,
    // because the single-line wordmark measures 15.55em at this tracking and
    // only fits beside the emblem in a 1280px container from ~1263px up; an
    // `sm` switch put a three-line type block next to an emblem sized for two
    // across most laptop widths.
    //
    // Left-aligned at BOTH breakpoints, unlike the standalone `vertical`
    // orientation, which stays centred for cards and the footer.
    return (
      <div
        className={[
          'flex flex-col items-start gap-3 text-left xl:flex-row xl:items-center xl:gap-6',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Two <img>s, CSS-swapped by breakpoint, are fine here — unlike the
            wordmark, the emblem carries no text content to duplicate for a
            screen reader (`alt=""` on both). */}
        <EmblemBadge size={VERTICAL_EMBLEM_SIZE} className="xl:hidden" />
        <EmblemBadge size={HORIZONTAL_EMBLEM_SIZE} className="hidden xl:block" />
        {wordmark}
      </div>
    );
  }

  if (orientation === 'horizontal') {
    return (
      <div className={['flex items-center gap-4 text-left', className].filter(Boolean).join(' ')}>
        <EmblemBadge size={HORIZONTAL_EMBLEM_SIZE} />
        {wordmark}
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
      {wordmark}
    </div>
  );
}
