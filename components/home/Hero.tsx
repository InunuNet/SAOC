'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';
import type { SanityImageSource } from '@sanity/image-url';

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

interface HeroSlide {
  src: string;
  alt: string;
  key: string;
}

export interface HeroProps {
  images?: SanityImageSource[] | null;
  /** Show identity from the nationalShow singleton — the CTA label is not a literal. */
  show?: ShowIdentity | null;
}

export function Hero({ images, show }: HeroProps) {
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

      {/* Dark sage scrim */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-primary/75 via-primary/75 to-primary/85"
      />

      {/* Content */}
      <div className="relative z-10 w-full px-8 md:px-16 py-24 flex flex-col items-center text-center max-w-[1280px] mx-auto">
        {/* Eyebrow pill */}
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ivory rounded-full border border-ivory/30 bg-white/10 px-4 py-1.5 mb-8">
          SINCE 1968 · BLOEMFONTEIN
        </span>

        {/* Headline */}
        <h1 id={HEADING_ID} className="h1 font-serif text-[clamp(54px,7vw,96px)] font-medium leading-[1.04] tracking-[-0.012em] text-ivory max-w-[18ch] mb-6">
          The national home of <em>orchid culture</em> in South Africa.
        </h1>

        {/* Lede */}
        <p className="font-sans text-[20px] leading-[1.5] text-ivory max-w-[52ch] mb-10">
          Uniting twenty-one affiliated societies in the cultivation, exhibition, and appreciation of orchids across South Africa since 1968.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-4 justify-start mb-10">
          <Link
            href="/societies"
            className="inline-flex items-center gap-2 font-sans text-[14px] font-medium bg-primary text-ivory px-6 py-3 hover:bg-primary-800 transition-colors duration-150"
          >
            Find Your Society
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <Link
            href="/national-show"
            className="font-sans text-[14px] font-medium border border-ivory/50 text-ivory px-6 py-3 hover:bg-ivory/10 transition-colors duration-150"
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
