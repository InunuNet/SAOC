// =============================================================
// SAOC — components/ui/PageHero.tsx
// Server Component — shared hero for interior pages (mission saoc-inner-heroes, NOS Design 2026-10-26).
// From 768px up the photograph is full bleed with its bloom bottom-left (the left 44% is the bare
// photograph) and the copy in a left-aligned column that starts at 52%, on a scrim local to that
// column. Below 768px the hero stacks: a 2/1 photograph band, the copy under it on solid sage.
// With no `image` the hero is typographic: the same copy on solid sage, no media and no scrim.
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
  /** Rendered under the lede, e.g. a call to action. */
  actions?: ReactNode;
  /** Marks the routes the PG-1 content-driven spacing exempts (the show band that follows stays flush). */
  exempt?: boolean;
}

const HERO_MIN_HEIGHT_CLASS = 'md:min-h-[480px]';
// The wide hero's box is at least this tall, so a source wider than the box x its height is height-driven.
const HERO_BOX_HEIGHT = 480;
const STACK_BELOW_QUERY = '(max-width: 767px)';
// The copy zone: the scrim is clear through the bloom side (44%) and reaches its full strength by 52%,
// where the copy column starts. Sage only (--primary-800), no wash over the bloom.
const SCRIM_CLEAR_UNTIL = '44%';
const SCRIM_FULL_FROM = '52%';
const SCRIM_ALPHA = 0.8;
const SCRIM_BACKGROUND = `linear-gradient(90deg, transparent 0, transparent ${SCRIM_CLEAR_UNTIL}, rgb(34 40 31 / ${SCRIM_ALPHA}) ${SCRIM_FULL_FROM})`;

export function PageHero({
  image,
  imagePosition = '50% 50%',
  eyebrow,
  heading,
  lede,
  facts,
  actions,
  exempt = false,
}: PageHeroProps) {
  const heroFacts = normaliseHeroFacts(facts);
  const aspect = image ? heroSourceAspect(image) : null;
  // A cover image is driven by the longer of box width and box height x aspect. Wide: the box is the
  // viewport wide and at least HERO_BOX_HEIGHT tall. Stacked: a 2/1 band, so its height is half the width.
  const sizes =
    aspect === null
      ? undefined
      : `${STACK_BELOW_QUERY} max(100vw, calc(50vw * ${aspect})), max(100vw, ${Math.ceil(HERO_BOX_HEIGHT * aspect)}px)`;

  return (
    <section
      data-page-hero
      data-page-hero-variant={image ? undefined : 'type'}
      data-hero-exempt={exempt ? '' : undefined}
      className={`relative isolate overflow-hidden bg-primary-800 md:flex md:items-center ${HERO_MIN_HEIGHT_CLASS}`}
    >
      {image ? (
        <>
          <div
            data-page-hero-media
            className="relative aspect-[2/1] w-full md:absolute md:inset-0 md:aspect-auto"
          >
            <HeroPicture
              src={image}
              priority
              sizes={sizes}
              className="object-cover"
              style={{ objectPosition: imagePosition }}
            />
          </div>
          <div
            data-hero-scrim="copy"
            aria-hidden="true"
            className="absolute inset-0 max-md:hidden"
            style={{ backgroundImage: SCRIM_BACKGROUND }}
          />
        </>
      ) : null}
      <div
        data-page-hero-copy
        className={`relative z-10 flex w-full flex-col items-start px-[var(--container-pad)] py-10 text-left md:py-16 ${
          image ? 'md:ml-[52%] md:w-[48%] md:pl-0' : 'saoc-container'
        }`}
      >
        {eyebrow ? (
          <span
            data-page-hero-eyebrow
            className="inline-flex items-center rounded-full border border-white/25 bg-[var(--primary-800)]/60 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory"
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
          <dl data-hero-facts data-fact-count={heroFacts.length} className="hero-facts">
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
