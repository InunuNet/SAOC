// =============================================================
// NOS — components/nos/NosHero.tsx
// Server Component. The R15 hero: full-bleed studio orchid photography under one
// 90deg near-black ramp (never purple), copy on the dark end. Geometry, ramps and
// the stack breakpoints live in app/(marketing)/national-show/nos-theme.css
// (`.nos-hero`), cited there to the approved mock; this file owns the DOM contract
// the F2 checks select on:
//
//   section[data-nos-hero="hub" | "inner"]   `display` titles are the hub, all others inner
//     [data-nos-hero-media] > img            the one photograph
//     h1                                     exactly one
//     [data-nos-hero-lede]                   the lede / standfirst
//
// Only the five rights-cleared production photographs may be passed as `image` —
// the 13-photo Ormerod set referenced in branding/ is NOT rights-cleared and must
// never reach this component (guardrail D5). No duotone, filter or vignette on the
// photograph itself; only the scrim ramp is applied, and only for legibility.
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
  title: ReactNode;
  /**
   * `default` renders the inner hero (R15 inner ramp, stacks at <=620px). `display`
   * renders the hub hero (6-stop ramp, 22% photo inset, stacks at <=700px) — reserve
   * for the one flagship hero.
   */
  titleSize?: 'default' | 'display';
  lede?: string;
  /**
   * Hub: the hero body's remaining children (facts, CTAs, countdown) — rendered as
   * direct children of the body grid so the stacked order can move the facts after
   * the CTAs. Inner: a single optional link row below the standfirst.
   */
  actions?: ReactNode;
  /** Loads the image eagerly at high priority — reserve for the above-the-fold hero. */
  priority?: boolean;
  className?: string;
}

export function NosHero({
  image,
  title,
  titleSize = 'default',
  lede,
  actions,
  priority = false,
  className = '',
}: NosHeroProps) {
  const isHub = titleSize === 'display';
  const kind = isHub ? 'hub' : 'inner';
  return (
    <section
      data-nos-hero={kind}
      // nos-on-dark: every hero renders over near-black, so focus rings and status
      // colours inside it read the on-dark aliases (see nos-theme.css).
      className={['nos-on-dark', 'nos-hero', `nos-hero-${kind}`, className].filter(Boolean).join(' ')}
    >
      <div data-nos-hero-media="" className="nos-hero-media">
        <Image
          src={image}
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          className="nos-hero-img"
        />
      </div>
      {isHub ? <div aria-hidden="true" className="nos-hero-scrim" /> : null}
      <div className="nos-hero-copy">
        <h1 className="nos-hero-title">{title}</h1>
        {isHub ? (
          <div className="nos-hero-body">
            {lede ? (
              <p data-nos-hero-lede="" data-nos-hero-text="lede" className="nos-hero-lede">
                {lede}
              </p>
            ) : null}
            {actions}
          </div>
        ) : (
          <>
            {lede ? (
              <p data-nos-hero-lede="" data-nos-hero-text="lede" className="nos-hero-lede">
                {lede}
              </p>
            ) : null}
            {actions ? <div className="nos-hero-actions">{actions}</div> : null}
          </>
        )}
      </div>
    </section>
  );
}
