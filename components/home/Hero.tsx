'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';
import type { SanityImageSource } from '@sanity/image-url';

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { heroImages as staticHeroImages } from '@/lib/data';
import { showLabelWithEdition, showYearOf } from '@/lib/show-identity';
import { urlFor } from '@/sanity/lib/image';
import type { ShowIdentity } from '@/types';

const CAROUSEL_INTERVAL_MS = 5500;
const HEADING_ID = 'home-hero-heading';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function slideLabel(index: number, total: number, subject: string): string {
  return `${index + 1} of ${total}${subject ? `: ${subject}` : ''}`;
}

const HERO_CTA_BASE =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[2px] border px-6 py-3 font-sans text-[14px] font-medium transition-colors duration-150 sm:w-auto focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px]';

interface HeroSlide {
  src: string;
  alt: string;
  key: string;
}

export interface HeroProps {
  images?: SanityImageSource[] | null;
  /** Show identity from the nationalShow singleton — the CTA label is not a literal. */
  show?: ShowIdentity | null;
  /** False on the public build: the lede states a society count the Council has not supplied. */
  showLede?: boolean;
}

export function Hero({ images, show, showLede = false }: HeroProps) {
  const showYear = showYearOf(show?.showDate);
  const showCtaLabel = `${showLabelWithEdition(show?.edition)}${showYear ? `, ${showYear}` : ''}`;
  const slides: HeroSlide[] =
    images && images.length > 0
      ? images.map((img, i) => ({
          key: `sanity-${i}`,
          src: urlFor(img).width(1600).url(),
          alt: '', // decorative — heroImages have no alt field
        }))
      : staticHeroImages.map((img) => ({ key: img.name, src: img.path, alt: img.alt }));

  const [activeIdx, setActiveIdx] = useState(0);
  const [userPaused, setUserPaused] = useState(false);

  // WCAG 2.2.2: autoplay stops under prefers-reduced-motion, and follows live changes.
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );

  useEffect(() => {
    if (reduceMotion || userPaused) return undefined;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % (slides.length || 1));
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides.length, reduceMotion, userPaused]);

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby={HEADING_ID}
      className="relative min-h-[720px] flex items-center overflow-hidden bg-primary on-dark"
    >
      {/* Crossfade image stack: opacity only, no transform (handoff README: fade, no slide) */}
      {slides.map((slide, i) => (
        <div
          key={slide.key}
          role="group"
          aria-roledescription="slide"
          aria-label={slideLabel(i, slides.length, slide.alt)}
          aria-hidden={activeIdx === i ? undefined : true}
          className={[
            'absolute inset-0 transition-opacity duration-[1400ms]',
            activeIdx === i ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            className="object-cover"
            priority={i === 0}
            sizes="100vw"
          />
        </div>
      ))}

      {/* F19 scrim: three aria-hidden layers (README l.125). The diagonal sage 60% to 25% keeps the
          carousel visible, the veil holds the copy at 4.5:1, the bone pull blends into the next section. */}
      <div aria-hidden="true" data-hero-scrim="diagonal" className="absolute inset-0" />
      <div aria-hidden="true" data-hero-scrim="veil" className="absolute inset-0" />
      <div aria-hidden="true" data-hero-scrim="bone" className="absolute inset-0" />

      {/* Content */}
      <div className="relative z-10 w-full px-8 md:px-16 py-24 flex flex-col items-center text-center max-w-[1280px] mx-auto">
        {/* Eyebrow pill */}
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ivory rounded-full border border-ivory/30 bg-white/10 px-4 py-1.5 mb-8">
          SINCE 1968 · BLOEMFONTEIN
        </span>

        {/* Headline */}
        <h1 id={HEADING_ID} className="h1 font-serif text-[clamp(54px,7vw,96px)] font-medium leading-[1.04] tracking-[-0.012em] text-ivory max-w-[18ch]">
          The national home of <em>orchid culture</em> in South Africa.
        </h1>

        {/* Lede: the society count is not in the Council's copy, so the public build withholds it. */}
        {showLede ? (
          <div data-placeholder="true" className="mt-4 flex flex-col items-center gap-3 md:mt-5">
            <p
              data-hero-lede
              className="font-sans text-[20px] leading-[1.5] text-ivory max-w-[52ch] text-pretty"
            >
              Uniting twenty-one affiliated societies in the cultivation, exhibition, and appreciation of orchids across South Africa since 1968.
            </p>
            <PlaceholderMarker tone="dark" />
          </div>
        ) : null}

        {/* CTAs: ivory fill and ivory outline read on the veil; same size, radius and sentence case. */}
        <div
          data-hero-ctas
          className={`flex w-full flex-col gap-4 sm:w-auto sm:flex-row mb-10 ${showLede ? 'mt-10' : 'mt-8'}`}
        >
          <Link
            href="/societies"
            data-hero-cta="primary"
            className={`${HERO_CTA_BASE} border-ivory bg-ivory text-primary hover:bg-bone hover:border-bone`}
          >
            Find your society
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <Link
            href="/national-show"
            data-hero-cta="secondary"
            className={`${HERO_CTA_BASE} border-ivory text-ivory hover:bg-ivory/10`}
          >
            {showCtaLabel}
          </Link>
        </div>

        {/* Pause/Play (WCAG 2.2.2) precedes the dots in DOM order. Moot under reduced motion. */}
        <div className="flex items-center gap-4 justify-start">
          {!reduceMotion && (
            <button
              type="button"
              aria-label={userPaused ? 'Play' : 'Pause'}
              onClick={() => setUserPaused((paused) => !paused)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border border-ivory/50 px-3 font-sans text-[14px] font-medium text-ivory hover:bg-ivory/10 transition-colors duration-150"
            >
              {userPaused ? (
                <Play size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Pause size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
              {userPaused ? 'Play' : 'Pause'}
            </button>
          )}

          {/* Dot indicators */}
          <div className="flex gap-1" role="group" aria-label="Carousel navigation">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                aria-label={`Show slide ${i + 1}${slide.alt ? `: ${slide.alt}` : ''}`}
                aria-current={activeIdx === i ? 'true' : undefined}
                onClick={() => setActiveIdx(i)}
                className="flex h-11 items-center px-1"
              >
                {/* Hit area is the 44px-tall button; the painted bar stays 2px. */}
                <span
                  aria-hidden="true"
                  className={[
                    'block h-[2px] transition-all duration-300',
                    activeIdx === i ? 'bg-accent' : 'bg-ivory/40',
                  ].join(' ')}
                  style={{ width: activeIdx === i ? '24px' : '16px' }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
