// =============================================================
// NOS — components/nos/NosHero.tsx
// Server Component. Full-bleed studio orchid photography under a
// dark-to-transparent royal-purple scrim, text on the dark end (design
// grammar — photography is the brand's signature device). No duotone,
// filter or vignette on the photograph itself — the flower supplies the
// colour; only the scrim gradient is applied, and only for legibility.
//
// Only the five rights-cleared production photographs may be passed as
// `image` — the 13-photo Ormerod set referenced in branding/ is NOT
// rights-cleared and must never reach this component (guardrail D5).
//
// The scrim was tuned to hold against the brightest cleared image,
// orchid-yellow.jpg (design grammar: "test that specific case") — density
// at the text end is deliberately higher than a mid-tone photo would need.
// =============================================================

import Image from 'next/image';
import type { ReactNode } from 'react';

export const NOS_HERO_IMAGES = [
  '/images/orchid-dark.jpg',
  '/images/orchid-pink.jpg',
  '/images/orchid-purple.jpg',
  '/images/orchid-violet.jpg',
  '/images/orchid-yellow.jpg',
] as const;

export type NosHeroImage = (typeof NOS_HERO_IMAGES)[number];

export interface NosHeroProps {
  image: NosHeroImage;
  /**
   * Rendered above the eyebrow, inside the scrim's dark band — typically a
   * `<Logo orientation="horizontal" tone="on-dark" />`. Optional: most heroes
   * don't carry the full lockup, only the flagship one did (retired in
   * favour of `titleIsElement`, below — the lockup now sits IN the headline
   * position, not above the eyebrow, so it goes through `title` instead).
   */
  brandMark?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  /**
   * Set when `title` is already a heading element (e.g.
   * `<Logo as="h1" size="hero" .../>`) rather than plain text — NosHero then
   * renders `title` bare instead of wrapping it in its own `<h1>`. Nesting
   * two `<h1>`s (Logo's and NosHero's) would be invalid and would give the
   * page two competing top-level headings.
   */
  titleIsElement?: boolean;
  lede?: string;
  /** Rendered below the lede, inside the scrim's dark band — typically a Button. */
  actions?: ReactNode;
  /** Loads the image eagerly at high priority — reserve for the above-the-fold hero. */
  priority?: boolean;
  className?: string;
}

export function NosHero({
  image,
  brandMark,
  eyebrow,
  title,
  titleIsElement = false,
  lede,
  actions,
  priority = false,
  className = '',
}: NosHeroProps) {
  return (
    <section
      className={[
        'relative flex min-h-[520px] items-end overflow-hidden bg-[var(--night)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Image
        src={image}
        alt=""
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover"
      />
      {/* Scrim: dark-to-transparent, bottom to top, purple-tinted near-black.
          Text sits in the dense band at the bottom. Tuned to clear 4.5:1 for
          pale-gold text against orchid-yellow.jpg's brightest region. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(14,11,36,0.95) 0%, rgba(14,11,36,0.82) 30%, rgba(14,11,36,0.45) 58%, rgba(14,11,36,0) 88%)',
        }}
      />
      {/* Second scrim, left to right, purple-tinted near-black. The text
          column is left-aligned inside the max-width container, but the
          photo's brightest region isn't guaranteed to sit under the
          right-hand two-thirds — orchid-yellow.jpg and orchid-pink.jpg (the
          two brightest cleared images) both have bright petals reaching
          into the left column, where small brand-tint text (an olive
          eyebrow, violet countdown digits) measured well under 4.5:1 even
          with the bottom-up scrim alone. This fade holds the text column
          dark regardless of what the photo underneath is doing there —
          on top of the bottom-up scrim, not instead of it. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(14,11,36,0.85) 0%, rgba(14,11,36,0.55) 42%, rgba(14,11,36,0.12) 72%, rgba(14,11,36,0) 100%)',
        }}
      />
      {/* Third scrim, top-down, whenever the hero carries text high up. The
          bottom-up scrim is deliberately near-transparent at the very top of
          the hero (it exists to hold a headline at the BOTTOM), so anything
          sitting above the eyebrow lands in an unscrimmed zone. Measured
          directly against the composited photo (not an average): without this,
          the lockup's Jost subtitle line read 2.44:1 on orchid-violet.jpg.

          Gated on `brandMark || titleIsElement`, not `brandMark` alone. When
          the lockup became the <h1> the brandMark went away and this band went
          with it — but the full-scale lockup is far taller than the text
          headline it replaced, so it pushes the whole content column UP into
          exactly the zone this band exists to cover. Re-measured worst-case
          across orchid-yellow/pink/violet at 390 and 1280 with the band gone:
          wordmark 1.37:1, strapline 2.49:1, eyebrow 1.23:1 — a regression, as
          the eyebrow had been passing.

          Retuned from h-[45%]/0.80 to h-[55%]/0.82 for the taller mark. Five
          candidates were measured: restoring the old 45% band passes but only
          reaches 4.84:1 on the strapline (too thin — that is the line that
          already failed once), while denser bands reach 11-13:1 and visibly
          flatten the photograph. This is the lightest scrim that clears 4.5:1
          with real margin (worst case 7.37:1). Gradient only — no duotone,
          filter or vignette ever touches the photograph. */}
      {brandMark || titleIsElement ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[55%]"
          style={{
            background:
              'linear-gradient(to bottom, rgba(14,11,36,0.82) 0%, rgba(14,11,36,0.60) 55%, rgba(14,11,36,0) 100%)',
          }}
        />
      ) : null}
      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-8 py-14">
        {brandMark ? <div className="mb-2">{brandMark}</div> : null}
        {/* Olive is legal text only on a flat royal-purple/night ground (6.16:1,
            golden table) — over a photograph, brand tints are decoration and
            legibility wins (guardrail 6). Measured `text-[var(--olive)]` at
            olive-on-bright-petal below 4.5:1 on orchid-yellow.jpg and
            orchid-pink.jpg; pale gold holds regardless of what's under it. */}
        {eyebrow ? (
          <span className="font-sans text-[12px] font-medium uppercase tracking-[0.3em] text-ivory">
            {eyebrow}
          </span>
        ) : null}
        {titleIsElement ? (
          title
        ) : (
          <h1 className="max-w-[20ch] font-serif text-[clamp(36px,5.6vw,64px)] font-medium leading-[1.05] text-ivory">
            {title}
          </h1>
        )}
        {lede ? (
          <p className="max-w-[58ch] font-sans text-[19px] leading-[1.55] text-[var(--lilac-pale)]">
            {lede}
          </p>
        ) : null}
        {actions ? <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
