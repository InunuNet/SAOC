'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';
import type { SanityImageSource } from '@sanity/image-url';

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { HOME_HERO_SLIDES } from '@/lib/data/home-hero-slides';
import { showLabelWithEdition, showYearOf } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';
import { nosUrl } from '@/lib/site-hosts';

const CAROUSEL_INTERVAL_MS = 7000;
const FADE_MS = 1400;
const HEADING_ID = 'home-hero-heading';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
// The hero is a full-bleed photograph: its source is served from the quality-88 variant set, up to 3840 wide.
const HERO_IMAGE_QUALITY = 88;

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function slideLabel(index: number, total: number, subject: string): string {
  return `${index + 1} of ${total}${subject ? `: ${subject}` : ''}`;
}

const HERO_CTA_BASE =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 border px-6 py-3 font-sans text-[14px] font-medium transition-colors duration-150 sm:w-auto focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px]';

const CONTROL_FOCUS =
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px]';

export interface HeroProps {
  /**
   * Sanity heroImages. No longer drives the imagery on this home: NOS Design ruled the slides
   * (hero-cards-ruling A2), so they come from HOME_HERO_SLIDES at full resolution. The prop stays so
   * the page and the Sanity type are unchanged.
   */
  images?: SanityImageSource[] | null;
  /** Show identity from the nationalShow singleton — the CTA label is not a literal. */
  show?: ShowIdentity | null;
  /** False on the public build: the lede states a society count the Council has not supplied. */
  showLede?: boolean;
}

export function Hero({ show, showLede = false }: HeroProps) {
  const showYear = showYearOf(show?.showDate);
  const showCtaLabel = `${showLabelWithEdition(show?.edition)}${showYear ? `, ${showYear}` : ''}`;
  const slides = HOME_HERO_SLIDES;

  const [activeIdx, setActiveIdx] = useState(0);
  const [leavingIdx, setLeavingIdx] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // WCAG 2.2.2: autoplay stops under prefers-reduced-motion, and follows live changes.
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );

  // The outgoing slide keeps drifting while it fades out, so its transform never snaps back in view.
  const goTo = (next: number) => {
    if (next === activeIdx) return;
    clearTimeout(leaveTimer.current);
    setLeavingIdx(activeIdx);
    setActiveIdx(next);
    leaveTimer.current = setTimeout(() => setLeavingIdx(null), FADE_MS);
  };
  const advance = () => goTo((activeIdx + 1) % slides.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby={HEADING_ID}
      data-home-hero
      data-paused={userPaused ? '' : undefined}
      className="home-hero relative isolate flex items-end overflow-hidden bg-primary-800 on-dark md:items-center"
      style={{ '--hero-interval': `${CAROUSEL_INTERVAL_MS}ms` } as CSSProperties}
    >
      {/* Crossfade image stack: opacity, plus a slow transform drift on the slide that is showing. */}
      {slides.map((slide, i) => {
        const isActive = activeIdx === i;
        const drifting = !reduceMotion && (isActive || leavingIdx === i);
        return (
          <div
            key={slide.key}
            role="group"
            aria-roledescription="slide"
            aria-label={slideLabel(i, slides.length, slide.alt)}
            aria-hidden={isActive ? undefined : true}
            data-hero-slide={slide.key}
            className={[
              'absolute inset-0 -z-10 transition-opacity duration-[1400ms] ease-(--ease)',
              isActive ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            <div className={['absolute inset-0', drifting ? 'home-hero-drift' : ''].join(' ')}>
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                className="home-hero-img"
                style={
                  {
                    '--hero-pos': slide.position,
                    '--hero-pos-sm': slide.positionSmall,
                  } as CSSProperties
                }
                priority={i === 0}
                sizes="100vw"
                quality={HERO_IMAGE_QUALITY}
              />
            </div>
          </div>
        );
      })}

      {/* One localised scrim (NOS Design ruling A4): the copy column is dark, the right 30% is bare photograph. */}
      <div aria-hidden="true" data-hero-scrim="copy" className="absolute inset-0 -z-10" />
      <div aria-hidden="true" data-hero-scrim="shade" className="absolute inset-0 -z-10" />

      {/* Content: left-aligned in the container, a 640px column (A3). */}
      <div className="saoc-container w-full pt-16 pb-28 md:py-24">
        <div className="flex max-w-[640px] flex-col items-start text-left">
          <span className="mb-8 rounded-full border border-ivory/30 bg-white/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-ivory">
            SINCE 1968 · BLOEMFONTEIN
          </span>

          <h1
            id={HEADING_ID}
            className="h1 font-serif text-[clamp(48px,7.4vw,96px)] font-light leading-[1.02] tracking-[-0.02em] text-ivory"
          >
            The national home of <em>orchid culture</em> in South Africa.
          </h1>

          {/* Lede: the society count is not in the Council's copy, so the public build withholds it. */}
          {showLede ? (
            <div data-placeholder="true" className="mt-4 flex flex-col items-start gap-3 md:mt-5">
              <p
                data-hero-lede
                className="max-w-[52ch] text-pretty font-sans text-[20px] leading-[1.5] text-ivory"
              >
                Uniting twenty-one affiliated societies in the cultivation, exhibition, and appreciation of orchids across South Africa since 1968.
              </p>
              <PlaceholderMarker tone="dark" />
            </div>
          ) : null}

          <div
            data-hero-ctas
            className={`flex w-full flex-col gap-4 sm:w-auto sm:flex-row ${showLede ? 'mt-10' : 'mt-8'}`}
          >
            <Link
              href="/societies"
              data-hero-cta="primary"
              className={`${HERO_CTA_BASE} border-ivory bg-ivory text-primary hover:bg-bone hover:border-bone`}
            >
              Find your society
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
            <a
              href={nosUrl('/')}
              data-hero-cta="secondary"
              className={`${HERO_CTA_BASE} border-ivory text-ivory hover:bg-ivory/10`}
            >
              {showCtaLabel}
            </a>
          </div>
        </div>
      </div>

      {/* Pause/Play (WCAG 2.2.2) precedes the indicators in DOM order. Out of the composition, bottom right (A8).
          Under reduced motion there is no autoplay, so no controls. */}
      {reduceMotion ? null : (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10">
          <div className="saoc-container flex justify-end">
            <div data-hero-controls className="pointer-events-auto flex items-center gap-1 rounded-full bg-primary-800/70 p-1 pr-3">
              <button
                type="button"
                aria-label={userPaused ? 'Play' : 'Pause'}
                onClick={() => setUserPaused((paused) => !paused)}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-ivory/60 text-ivory transition-colors duration-150 hover:bg-ivory/10 ${CONTROL_FOCUS}`}
              >
                {userPaused ? (
                  <Play size={16} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Pause size={16} strokeWidth={1.5} aria-hidden="true" />
                )}
              </button>

              <div className="flex" role="group" aria-label="Carousel navigation">
                {slides.map((slide, i) => (
                  <button
                    key={slide.key}
                    type="button"
                    aria-label={`Show slide ${i + 1}${slide.alt ? `: ${slide.alt}` : ''}`}
                    aria-current={activeIdx === i ? 'true' : undefined}
                    onClick={() => goTo(i)}
                    className={`flex h-11 w-11 items-center justify-center ${CONTROL_FOCUS}`}
                  >
                    {/* The hit area is the 44px button; the painted track is 28 by 2. The active one fills
                        brass over the interval, and its end advances the carousel, so Pause holds both. */}
                    <span
                      aria-hidden="true"
                      className="relative block h-[2px] w-7 overflow-hidden bg-ivory/40"
                    >
                      {activeIdx === i ? (
                        <span
                          key={`${activeIdx}-fill`}
                          data-hero-fill
                          className="home-hero-fill absolute inset-0 bg-accent"
                          onAnimationEnd={(event) => {
                            if (event.target === event.currentTarget) advance();
                          }}
                        />
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
