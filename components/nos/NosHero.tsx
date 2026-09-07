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
            'linear-gradient(to top, rgba(14,11,36,0.92) 0%, rgba(14,11,36,0.72) 32%, rgba(14,11,36,0.28) 62%, rgba(14,11,36,0) 100%)',
        }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-8 py-14">
        {eyebrow ? (
          <span className="font-sans text-[12px] font-medium uppercase tracking-[0.3em] text-[var(--olive)]">
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
