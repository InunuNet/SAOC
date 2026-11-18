// =============================================================
// SAOC — components/ui/PageHero.tsx
// Server Component — shared hero for interior pages (mission saoc-inner-heroes, NOS Design 2026-10-26).
// From 1024px the photograph is a left-anchored panel, with its bloom bottom-left, faded into the
// sage behind the right-hand copy. At 768-1023px it fills the width with the same faded edge.
// Below 768px the hero stacks: a 2/1 photograph band, the copy under it on solid sage.
// With no `image` the same geometry and copy column sit on solid sage.
// =============================================================

import type { ReactNode } from 'react';
import { HeroPicture } from '@/components/ui/HeroPicture';
import { normaliseHeroFacts, type HeroFact } from '@/lib/hero-facts';
import { heroSourceAspect } from '@/lib/data/saoc-hero-photos';

interface PageHeroProps {
  /** The photograph (a path in public/images). Omit it for the typographic hero. */
  image?: string;
  /** CSS object-position of the photograph: the ruled crop for the route. */
  imagePosition?: string;
  eyebrow?: string;
  heading: ReactNode;
  lede?: string;
  /** The page's leading facts (2 to 4), rendered under the lede and above `actions`. */
  facts?: readonly HeroFact[];
  /** How the facts sit: centred (the default) or left-aligned from the h1 edge (the event hero). */
  factsAlign?: 'center' | 'start';
  /** Rendered under the lede, e.g. a call to action. */
  actions?: ReactNode;
  /** Marks the routes the PG-1 content-driven spacing exempts (the show band that follows stays flush). */
  exempt?: boolean;
}

const HERO_MIN_HEIGHT_CLASS = 'min-h-[520px] md:min-h-[540px] lg:min-h-[600px]';
// The wide hero's box is at least this tall, so a source wider than the box x its height is height-driven.
const HERO_BOX_HEIGHT = 600;
const STACK_BELOW_QUERY = '(max-width: 767px)';
// The photograph itself is masked to reveal the section's --primary-800 background in globals.css.

export function PageHero({
  image,
  imagePosition = '50% 50%',
  eyebrow,
  heading,
  lede,
  facts,
  factsAlign = 'center',
  actions,
  exempt = false,
}: PageHeroProps) {
  const heroFacts = normaliseHeroFacts(facts);
  const aspect = image ? heroSourceAspect(image) : null;
  // A cover image is driven by the longer of box width and box height x aspect. Wide: the box is the
  // viewport wide and at least HERO_BOX_HEIGHT tall through tablet. From 1024px the panel has a
  // 1500px width cap. Stacked: a 2/1 band, so its height is half the width.
  const sizes =
    aspect === null
      ? undefined
      : `${STACK_BELOW_QUERY} max(100vw, calc(50vw * ${aspect})), (max-width: 1023px) max(100vw, ${Math.ceil(HERO_BOX_HEIGHT * aspect)}px), min(100vw, 1500px)`;

  return (
    <section
      data-page-hero
      data-page-hero-variant={image ? undefined : 'type'}
      data-hero-exempt={exempt ? '' : undefined}
      className={`relative isolate flex flex-col justify-center overflow-hidden bg-primary-800 md:flex-row md:items-center ${HERO_MIN_HEIGHT_CLASS}`}
    >
      {image ? (
        <div
          data-page-hero-media
          className="relative aspect-[2/1] w-full shrink-0 md:absolute md:inset-0 md:aspect-auto lg:right-auto lg:w-[min(100%,1500px)]"
        >
          <HeroPicture
            src={image}
            priority
            sizes={sizes}
            className="object-cover"
            style={{ objectPosition: imagePosition }}
          />
        </div>
      ) : null}
      <div
        data-page-hero-copy
        className="relative z-10 flex w-full flex-col items-start px-[var(--container-pad)] py-10 text-left md:ml-[52%] md:w-[min(48%,calc(var(--container-max)/2_-_2%))] md:pl-0 md:py-16"
      >
        {eyebrow ? (
          <span
            data-page-hero-eyebrow
            className="inline-flex items-center rounded-full border border-white/25 bg-[var(--primary-800)]/60 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory"
          >
            {eyebrow}
          </span>
        ) : null}
        <h1
          className={`${eyebrow ? 'mt-5 ' : ''}max-w-3xl font-serif tracking-[-0.015em] font-light text-[clamp(42px,5.4vw,72px)] leading-[1.05] text-ivory`}
        >
          {heading}
        </h1>
        {lede ? (
          <p
            data-page-hero-lede
            className="mt-5 max-w-2xl font-sans text-[16px] leading-[1.55] text-ivory text-pretty"
          >
            {lede}
          </p>
        ) : null}
        {heroFacts ? (
          <dl
            data-hero-facts
            data-fact-count={heroFacts.length}
            data-facts-align={factsAlign}
            className="hero-facts"
          >
            {heroFacts.map((fact) => (
              <div key={fact.term} data-hero-fact>
                <dt>{fact.term}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {actions ? <div className="[&>div]:justify-start">{actions}</div> : null}
      </div>
    </section>
  );
}
