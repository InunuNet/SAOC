// =============================================================
// SAOC — components/ui/PageHero.tsx
// Server Component — shared hero for interior pages (mission saoc-inner-heroes, NOS Design 2026-10-26).
// From 1024px the photograph is full bleed with its bloom bottom-left (the left 34% is the bare
// photograph) and the copy in a left-aligned column that starts at 52%, on an eased scrim local to
// that column. The hero and everything in it scale with the viewport width (globals.css).
// Below 1024px the photograph stays full bleed behind the copy, which fills the width on an even scrim.
// With no `image` the same geometry and copy column sit on solid sage.
// =============================================================

import type { CSSProperties, ReactNode } from 'react';
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

// From 1024px the box is 600/2048 of the width tall (29.3vw), so a source wider than the box is height-driven.
const DESKTOP_HEIGHT_VW = 29.3;
// Below 1024px the hero is content-tall, about this many px on a phone.
const STACKED_BOX_HEIGHT = 520;
const STACK_BELOW_QUERY = '(max-width: 1023px)';
// The copy zone: the scrim is clear through the bloom side (34%), eases in over the stops below (alpha,
// position in percent) and reaches its full strength by 52%, where the copy column starts (HM-5).
// Sage only (--primary-800), no wash over the bloom.
const SCRIM_STOPS: readonly (readonly [number, number])[] = [
  [0, 34],
  [0.06, 38],
  [0.16, 42],
  [0.32, 45],
  [0.52, 48],
  [0.7, 50.5],
  [0.8, 52],
];
const SCRIM_BACKGROUND = `linear-gradient(90deg, transparent 0, ${SCRIM_STOPS.map(
  ([alpha, at]) => `rgb(34 40 31 / ${alpha}) ${at}%`,
).join(', ')})`;

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
  // A cover image is driven by the longer of box width and box height x aspect.
  const sizes =
    aspect === null
      ? undefined
      : `${STACK_BELOW_QUERY} max(100vw, ${Math.ceil(STACKED_BOX_HEIGHT * aspect)}px), max(100vw, calc(${DESKTOP_HEIGHT_VW}vw * ${aspect}))`;

  return (
    <section
      data-page-hero
      data-page-hero-variant={image ? undefined : 'type'}
      data-hero-exempt={exempt ? '' : undefined}
      className="relative isolate flex items-center overflow-hidden bg-primary-800"
    >
      {image ? (
        <>
          <div data-page-hero-media className="absolute inset-0">
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
            className="absolute inset-0"
            style={{ '--scrim-gradient': SCRIM_BACKGROUND } as CSSProperties}
          />
        </>
      ) : null}
      <div
        data-page-hero-copy
        className="relative z-10 flex w-full flex-col items-start px-[var(--container-pad)] text-left lg:ml-[52%] lg:w-[min(48%,max(calc(var(--container-max)/2_-_2%),calc(var(--u)*651)))] lg:pl-0"
      >
        {eyebrow ? (
          <span
            data-page-hero-eyebrow
            className="inline-flex items-center rounded-full border border-white/25 bg-[var(--primary-800)]/60 font-mono uppercase tracking-[0.18em] text-ivory"
          >
            {eyebrow}
          </span>
        ) : null}
        <h1
          className="max-w-3xl font-serif tracking-[-0.015em] font-light leading-[1.05] text-ivory"
        >
          {heading}
        </h1>
        {lede ? (
          <p
            data-page-hero-lede
            className="max-w-2xl font-sans leading-[1.55] text-ivory text-pretty"
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
