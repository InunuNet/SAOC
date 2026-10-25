// =============================================================
// SAOC — components/ui/PageHero.tsx
// Server Component — shared full-bleed hero for interior pages.
// =============================================================

import Image from 'next/image';
import type { ReactNode } from 'react';
import { normaliseHeroFacts, type HeroFact } from '@/lib/hero-facts';
import heroSourceWidths from '@/lib/hero-source-widths.json';

interface PageHeroProps {
  image: string;
  eyebrow?: string;
  heading: ReactNode;
  lede?: string;
  /** The page's leading facts (2 to 4), rendered under the lede and above `actions`. */
  facts?: readonly HeroFact[];
  /** Rendered under the lede, e.g. a call to action. */
  actions?: ReactNode;
  minHeight?: string;
  /** The pre-PG-1 hero (480px floor, copy at the foot), kept only on the routes PG-1 exempts. */
  exempt?: boolean;
}

// PG-1: a content-driven hero. The floor scales with the viewport and the copy, centred with its pill,
// grows past it only for a longer lede, the facts row or actions.
const HERO_MIN_HEIGHT = 'clamp(320px, 22vw, 380px)';
const EXEMPT_MIN_HEIGHT = '480px';

export function PageHero({
  image,
  eyebrow,
  heading,
  lede,
  facts,
  actions,
  minHeight,
  exempt = false,
}: PageHeroProps) {
  const heroFacts = normaliseHeroFacts(facts);
  return (
    <section
      data-page-hero
      data-hero-exempt={exempt ? '' : undefined}
      className={`relative isolate flex overflow-hidden ${exempt ? 'items-end' : 'items-center'}`}
      style={{ minHeight: minHeight ?? (exempt ? EXEMPT_MIN_HEIGHT : HERO_MIN_HEIGHT) }}
    >
      <Image
        src={image}
        alt=""
        fill
        priority
        sizes="100vw"
        quality={image in heroSourceWidths ? 88 : undefined}
        className="object-cover"
        aria-hidden="true"
      />
      <div
        className={`absolute inset-0 bg-gradient-to-t ${
          heroFacts
            ? 'from-[var(--primary-800)]/95 via-[var(--primary-800)]/65 via-60% to-[var(--primary-800)]/45'
            : exempt
              ? 'from-[var(--primary-800)]/85 via-[var(--primary-800)]/55 to-[var(--primary-800)]/25'
              : 'from-[var(--primary-800)]/88 via-[var(--primary-800)]/75 to-[var(--primary-800)]/60'
        }`}
        aria-hidden="true"
      />
      <div className={`saoc-container relative z-10 w-full ${exempt ? 'pb-16 pt-28' : 'py-16'} flex flex-col items-center text-center`}>
        {eyebrow ? (
          <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory">
            {eyebrow}
          </span>
        ) : null}
        <h1 className={`${eyebrow ? 'mt-5 ' : ''}max-w-3xl font-serif tracking-[-0.015em] font-light text-[clamp(42px,5.4vw,72px)] leading-[1.05] text-ivory`}>
          {heading}
        </h1>
        {lede ? (
          <p className="mt-5 max-w-2xl font-sans text-[16px] leading-[1.55] text-ivory/85 text-pretty">
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
        {actions}
      </div>
    </section>
  );
}
