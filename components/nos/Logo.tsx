// =============================================================
// NOS — components/nos/Logo.tsx
// Server Component. Layout B lockup — the approved identity (design grammar):
// the emblem above (vertical) or beside (horizontal) a single-line
// "NATIONAL ORCHID SHOW" wordmark in Cormorant Garamond, over a wide-tracked
// "WESTERN CAPE · 2027" line in Jost. The retired circular badge lockup is
// never used here, in any orientation.
// =============================================================

import { EmblemBadge } from './EmblemBadge';

export interface NosLogoProps {
  /** `on-dark` for use over the royal-purple/night ground. */
  tone?: 'light' | 'on-dark';
  /**
   * `vertical` (default, unchanged) stacks the emblem above the wordmark,
   * centred — the mark for a card or footer. `horizontal` sets the emblem
   * beside the two wordmark lines, left-aligned — the "full format" lockup
   * for a wide surface like a hero. `responsive` stacks below `sm` and goes
   * inline from `sm` up, rendered as ONE element — used where the lockup is
   * itself the page's `<h1>` (see `as`) and swapping between two CSS-hidden
   * instances would put two competing headings in the DOM. It is left-aligned
   * at both breakpoints, so it sits flush with the hero column beneath it;
   * only the standalone `vertical` mark is centred.
   */
  orientation?: 'vertical' | 'horizontal' | 'responsive';
  /**
   * `default` (unchanged) is the compact mark sized for a card, nav or
   * footer. `hero` scales the emblem and wordmark up to occupy a hero's
   * headline block — reserve for the one page that replaces its `<h1>`
   * with this lockup (Brad, 2026-09-07).
   */
  size?: 'default' | 'hero';
  /**
   * Renders the lockup's outer element as an `<h1>` instead of a `<div>` —
   * for when the lockup replaces the page's headline. The emblem stays a
   * decorative image (`alt=""`, set by `EmblemBadge`); the wordmark spans
   * carry the real heading text, so the `<h1>` stays fully text-reachable
   * for SEO and screen readers with no visually-hidden duplicate needed.
   */
  as?: 'div' | 'h1';
  className?: string;
}

// Horizontal, default size: the emblem's pixel size is picked so its optical
// height matches the two-line wordmark block, not hard-coded arbitrarily.
// Wordmark block height ≈ (22px title * 1.15 line-height) + 4px gap +
// (11px subtitle * 1.3 line-height) ≈ 25 + 4 + 14 = ~44px. EmblemBadge's
// viewBox is 1264×848 (~1.49:1), so an emblem *width* of 66px renders at
// height 66 * 848/1264 ≈ 44px — a lockup where the mark and the type
// disagree in height reads as broken, per the design grammar.
const HORIZONTAL_EMBLEM_SIZE = 66;
const VERTICAL_EMBLEM_SIZE = 56;

// Hero size: same "match the wordmark block's optical height" reasoning as
// above, re-derived at the hero's much larger clamp() type sizes. Title runs
// clamp(36px,5.6vw,64px) at tracking 0.16em; subtitle runs clamp(18px,
// 2.8vw,32px) at tracking 0.3em (half the title, matching the default
// lockup's 22:11 ratio). Wordmark block height ≈ title*1.15 + 8px gap +
// subtitle*1.2 line-height, and emblem width ≈ that height * 1264/848
// (~1.49). Evaluated at the clamp() endpoints (36/18 and 64/32) and
// expressed as a matching clamp() so the emblem scales continuously with
// the type instead of snapping at a breakpoint. Horizontal needs to match a
// two-line wordmark block (as above); vertical sits above a stacked block,
// so it uses a plainer viewport-driven clamp — precision there matters less
// since nothing beside it needs to line up.
const HERO_TITLE_CLASS = 'text-[clamp(36px,5.6vw,64px)] tracking-[0.16em] leading-[1.05]';
const HERO_SUBTITLE_CLASS = 'text-[clamp(18px,2.8vw,32px)] tracking-[0.3em]';
const HERO_EMBLEM_VERTICAL_CLASS = 'w-[clamp(88px,22vw,140px)] h-auto';
const HERO_EMBLEM_HORIZONTAL_CLASS = 'w-[clamp(104px,14.5vw,180px)] h-auto';

export function Logo({
  tone = 'light',
  orientation = 'vertical',
  size = 'default',
  as = 'div',
  className = '',
}: NosLogoProps) {
  const isDark = tone === 'on-dark';
  const isHero = size === 'hero';
  const Container = as;

  const titleClasses = [
    'font-serif font-medium uppercase',
    isHero ? HERO_TITLE_CLASS : 'text-[22px] tracking-[0.16em]',
    isDark ? 'text-ivory' : 'text-ink',
  ].join(' ');

  const subtitleClasses = [
    'font-sans font-medium uppercase',
    isHero ? HERO_SUBTITLE_CLASS : 'text-[11px] tracking-[0.3em]',
    // Default size: lilac-muted holds fine on the flat dark ground the
    // compact lockup is normally used on (nav/footer). At hero size the
    // lockup sits over full-bleed photography instead — measured
    // lilac-muted there at 3.35:1 on orchid-violet.jpg and 3.76:1 on
    // orchid-yellow.jpg (below 4.5:1); pale ivory holds regardless of the
    // photo underneath, same reasoning as the eyebrow/edition/countdown
    // fixes in NosHero.tsx and ShowCountdown.tsx.
    isDark ? (isHero ? 'text-ivory/85' : 'text-[var(--lilac-muted)]') : 'text-muted',
  ].join(' ');

  // A <span>, not a <div>: with `as="h1"` this wrapper sits inside the heading,
  // and <h1> takes phrasing content only — a <div> there is invalid HTML.
  // `flex flex-col` gives the span the same stacking it had as a div, so the
  // rendering is unchanged at every call site.
  const wordmark = (
    <span className="flex flex-col gap-1">
      <span className={titleClasses}>National Orchid Show</span>
      <span className={subtitleClasses}>Western Cape · 2027</span>
    </span>
  );

  if (orientation === 'responsive') {
    // One emblem, one wordmark — never two swapped instances. Layout (stacked
    // vs inline) and emblem size both switch at `sm` via CSS, not by rendering
    // a second copy.
    //
    // Left-aligned at BOTH breakpoints, unlike the standalone `vertical`
    // orientation, which stays centred for cards and the footer. This lockup
    // is the hero's <h1>, and everything below it in that column — the
    // eyebrow, "Edition XIX", the fact strip, the CTAs — is left-aligned; a
    // centred mark over a left-aligned column reads as a misaligned seam at
    // 390px rather than as one heading block (Brad, 2026-09-07).
    const emblemClasses = isHero
      ? `${HERO_EMBLEM_VERTICAL_CLASS} sm:hidden`
      : 'sm:hidden';
    const emblemClassesDesktop = isHero
      ? `hidden sm:block ${HERO_EMBLEM_HORIZONTAL_CLASS}`
      : 'hidden sm:block';
    return (
      <Container
        className={[
          'flex flex-col items-start gap-3 text-left sm:flex-row sm:items-center sm:gap-6',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Two <img>s, CSS-swapped by breakpoint, are fine here — unlike the
            wordmark, the emblem carries no text content to duplicate for a
            screen reader (`alt=""` on both). */}
        <EmblemBadge size={VERTICAL_EMBLEM_SIZE} className={emblemClasses} />
        <EmblemBadge size={HORIZONTAL_EMBLEM_SIZE} className={emblemClassesDesktop} />
        {wordmark}
      </Container>
    );
  }

  if (orientation === 'horizontal') {
    return (
      <Container
        className={['flex items-center gap-4 text-left', className].filter(Boolean).join(' ')}
      >
        <EmblemBadge
          size={HORIZONTAL_EMBLEM_SIZE}
          className={isHero ? HERO_EMBLEM_HORIZONTAL_CLASS : undefined}
        />
        {wordmark}
      </Container>
    );
  }

  return (
    <Container
      className={['flex flex-col items-center gap-2 text-center', className]
        .filter(Boolean)
        .join(' ')}
    >
      <EmblemBadge
        size={VERTICAL_EMBLEM_SIZE}
        className={isHero ? HERO_EMBLEM_VERTICAL_CLASS : undefined}
      />
      {wordmark}
    </Container>
  );
}
