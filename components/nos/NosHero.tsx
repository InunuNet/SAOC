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
   * don't carry the full lockup, only the flagship one does.
   */
  brandMark?: ReactNode;
  eyebrow?: string;
  title: string;
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
      {/* Second scrim, top-down, only when a brandMark is present. The bottom
          scrim above is deliberately near-transparent at the very top of the
          hero (it exists to hold the headline at the bottom) — a brandMark
          sitting above the eyebrow lands in that unscrimmed zone. Measured
          directly against the composited photo (not an average): without
          this, the lockup's Jost subtitle line read 2.44:1 on
          orchid-violet.jpg — below the 4.5:1 minimum. This band brings it to
          the same ~0.8 density as the bottom scrim's text zone. */}
      {brandMark ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[45%]"
          style={{
            background:
              'linear-gradient(to bottom, rgba(14,11,36,0.8) 0%, rgba(14,11,36,0.55) 55%, rgba(14,11,36,0) 100%)',
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
        <h1 className="max-w-[20ch] font-serif text-[clamp(36px,5.6vw,64px)] font-medium leading-[1.05] text-ivory">
          {title}
        </h1>
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
