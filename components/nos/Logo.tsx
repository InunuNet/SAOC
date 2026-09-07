// =============================================================
// NOS — components/nos/Logo.tsx
// Server Component. Layout B lockup — the approved identity (design grammar):
// the emblem above (vertical) or beside (horizontal) a single-line
// "NATIONAL ORCHID SHOW" wordmark in Cormorant Garamond, over a wide-tracked
// "WESTERN CAPE · 2027" line in Jost. The retired circular badge lockup is
// never used here, in any orientation.
// =============================================================

import type { CSSProperties } from 'react';

import { EmblemBadge } from './EmblemBadge';

export interface NosLogoProps {
  /** `on-dark` for use over the royal-purple/night ground. */
  tone?: 'light' | 'on-dark';
  /**
   * `vertical` (default, unchanged) stacks the emblem above the wordmark,
   * centred — the mark for a card or footer. `horizontal` sets the emblem
   * beside the two wordmark lines, left-aligned — the "full format" lockup
   * for a wide surface like a hero. `responsive` stacks below `xl` and goes
   * inline from `xl` up, rendered as a single element — used where the lockup
   * is itself the page's `<h1>` (see the element prop below) and swapping
   * between two CSS-hidden instances would put two competing headings in the
   * DOM. It is left-aligned at both breakpoints, so it sits flush with the
   * hero column beneath it; only the standalone `vertical` mark is centred.
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

// Hero size. Title runs clamp(36px,5.6vw,64px) at tracking 0.16em; subtitle
// runs clamp(18px,2.8vw,32px) at tracking 0.3em (half the title, matching the
// default lockup's 22:11 ratio).
//
// The inline layout switches at `xl`, NOT `sm`. Measured, the single-line
// wordmark is 15.55em wide at this tracking (995px at the 64px clamp maximum).
// Against a content column of `min(1280px, 100vw) - 64px` minus the emblem and
// gap, that only fits beside the emblem from ~1263px up — so an `sm` switch
// put a THREE-line type block (wrapped title + strapline) next to an emblem
// sized for two, across roughly 640-1200px, which is most laptop widths. That
// is the exact mark/type height disagreement the default-size comment above
// warns about. Above 1280px every value here is fixed (the container caps at
// 1280), so the inline layout either fits or does not — it cannot drift.
//
// Below `xl` the stacked layout carries it, and the wordmark still holds ONE
// line down to ~624px, where 15.55 * 36px finally exceeds the column. Only
// genuinely narrow phones wrap it, which is the one place a broken wordmark
// reads as a stacked lockup rather than a mistake.
// The hero's type scale, named once as a CSS custom property so the emblem is
// DERIVED from it instead of hand-tuned against it. A constant emblem width is
// what failed here: 168px was picked to fit horizontally and silently came out
// 8px shorter than the block it was supposed to match.
const HERO_TITLE_SIZE = 'clamp(36px,5.6vw,64px)';
const HERO_TITLE_CLASS =
  'text-[length:var(--nos-hero-title)] tracking-[0.16em] leading-[1.05]';
const HERO_SUBTITLE_CLASS = 'text-[clamp(18px,2.8vw,32px)] tracking-[0.3em]';
// Stacked: nothing sits beside the emblem, so it does not need to match a
// height — it is free to be the signature the show asked for. The 132px floor
// is deliberate: at 390px the previous 88px read as a supporting mark against a
// two-line wordmark, not as the emblem of the block.
const HERO_EMBLEM_VERTICAL_CLASS = 'w-[clamp(132px,16vw,220px)] h-auto';
// Inline: the emblem must match the wordmark block's optical height, so it is
// computed from the title size rather than stated. Measured rendered block
// height across 36/50/57/64px titles is title*1.8 + 6px (title leading 1.05,
// 4px gap, half-size subtitle at Jost's normal leading). EmblemBadge's viewBox
// is 1264x848, so width = height * 1.4906 = title*2.683 + 9px. Change the type
// scale above and the emblem follows on its own.
const HERO_EMBLEM_HORIZONTAL_CLASS =
  'w-[calc(var(--nos-hero-title)*2.683_+_9px)] h-auto';

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

  // Type assertion: React's CSSProperties has no index signature for CSS custom
  // properties, but the DOM accepts them and React forwards them verbatim.
  const heroStyle: CSSProperties | undefined = isHero
    ? ({ '--nos-hero-title': HERO_TITLE_SIZE } as CSSProperties) // custom prop, see above
    : undefined;

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
    // vs inline) and emblem size both switch at `xl` via CSS, not by rendering
    // a second copy. See the sizing constants above for why the switch is at
    // `xl` and not `sm`.
    //
    // Left-aligned at BOTH breakpoints, unlike the standalone `vertical`
    // orientation, which stays centred for cards and the footer. This lockup
    // is the hero's <h1>, and everything below it in that column — the
    // eyebrow, "Edition XIX", the fact strip, the CTAs — is left-aligned; a
    // centred mark over a left-aligned column reads as a misaligned seam at
    // 390px rather than as one heading block (Brad, 2026-09-07).
    const emblemClasses = isHero
      ? `${HERO_EMBLEM_VERTICAL_CLASS} xl:hidden`
      : 'xl:hidden';
    const emblemClassesDesktop = isHero
      ? `hidden xl:block ${HERO_EMBLEM_HORIZONTAL_CLASS}`
      : 'hidden xl:block';
    return (
      <Container
        className={[
          'flex flex-col items-start gap-3 text-left xl:flex-row xl:items-center xl:gap-6',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={heroStyle}
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
        style={heroStyle}
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
      style={heroStyle}
    >
      <EmblemBadge
        size={VERTICAL_EMBLEM_SIZE}
        className={isHero ? HERO_EMBLEM_VERTICAL_CLASS : undefined}
      />
      {wordmark}
    </Container>
  );
}
