'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';
import type { SanityImageSource } from '@sanity/image-url';

import { HeroPicture } from '@/components/ui/HeroPicture';
import { HOME_HERO_SLIDES } from '@/lib/data/home-hero-slides';
import { heroSourceAspect } from '@/lib/data/saoc-hero-photos';
import { formatShowDateRange } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';
import { nosUrl } from '@/lib/site-hosts';

const CAROUSEL_INTERVAL_MS = 7000;
const FADE_MS = 1400;
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
  'inline-flex w-full items-center justify-between rounded-[2px] border font-medium tracking-[0.01em] transition-[translate,background-color,border-color,color,text-decoration-color] duration-150 ease-(--ease) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px] motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 hover:-translate-y-px focus-visible:-translate-y-px active:translate-y-0';
const HERO_CTA_META =
  'font-mono leading-[1.5] uppercase tracking-[0.18em] text-ivory/80 lg:whitespace-nowrap';

// The photograph is full bleed behind the copy at every width. From 1024px the box is 40vw tall (the
// 2048-wide reference frame is 820px), so a source wider than 2.5:1 is height-driven. Below 1024px the
// hero is content-tall, about STACKED_BOX_HEIGHT px on a phone.
const DESKTOP_HEIGHT_VW = 40;
const STACKED_BOX_HEIGHT = 760;
const CONTROL_FOCUS =
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px]';

export interface HeroProps {
  /**
   * Sanity heroImages. Brad's 18 Nov slide order comes from HOME_HERO_SLIDES at full resolution.
   * The prop stays so the page and the Sanity type are unchanged.
   */
  images?: SanityImageSource[] | null;
  /** Show identity from the nationalShow singleton — the CTA label is not a literal. */
  show?: ShowIdentity | null;
  /** Count of the same listed societies shown by /societies. */
  societyCount?: number | null;
}

export function Hero({ show, societyCount }: HeroProps) {
  // Brad, 18 Nov: the hero button reads the official name with no edition number.
  const showCtaLabel = 'National Orchid Show';
  const showDates = formatShowDateRange(show?.showDate, show?.showEndDate);
  const slides = HOME_HERO_SLIDES;

  const [activeIdx, setActiveIdx] = useState(0);
  const [leavingIdx, setLeavingIdx] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [activationCounts, setActivationCounts] = useState(() => slides.map(() => 0));
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // WCAG 2.2.2: autoplay stops under prefers-reduced-motion, and follows live changes.
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
  useEffect(() => () => {
    clearTimeout(leaveTimer.current);
  }, []);

  // Keep the outgoing zoom running through its fade; remount an image on reactivation so it starts wide.
  const goTo = (next: number) => {
    if (next === activeIdx) return;
    clearTimeout(leaveTimer.current);
    setLeavingIdx(activeIdx);
    setActivationCounts((counts) => counts.map((count, i) => i === next ? count + 1 : count));
    setActiveIdx(next);
    leaveTimer.current = setTimeout(() => setLeavingIdx(null), FADE_MS);
  };
  // The first slide never fades in: an animated LCP element counts from the end of its animation, so
  // the crossfade only exists once the carousel has moved off slide 0.
  const fades = activeIdx !== 0 || leavingIdx !== null;
  const advance = () => goTo((activeIdx + 1) % slides.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby={HEADING_ID}
      data-home-hero
      data-paused={userPaused ? '' : undefined}
      className="home-hero relative isolate overflow-hidden bg-primary-800 on-dark"
      style={{ '--hero-interval': `${CAROUSEL_INTERVAL_MS}ms` } as CSSProperties}
    >
      {/* Crossfade image stack: opacity, plus a slow zoom on the slide that is showing. The photograph is
          the full-bleed background of the copy at every width. */}
      <div data-home-hero-media className="absolute inset-0 overflow-hidden">
        {slides.map((slide, i) => {
          const isActive = activeIdx === i;
          const zooming = !reduceMotion && (isActive || leavingIdx === i);
          const aspect = heroSourceAspect(slide.src);
          return (
            <div
              key={slide.key}
              role="group"
              aria-roledescription="slide"
              aria-label={slideLabel(i, slides.length, slide.alt)}
              aria-hidden={isActive ? undefined : true}
              data-hero-slide={slide.key}
              className={[
                'absolute inset-0',
                fades ? 'transition-opacity duration-[1400ms] ease-(--ease)' : '',
                isActive ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            >
              <div
                key={`${slide.key}-${activationCounts[i]}`}
                className={['absolute inset-0', zooming ? 'home-hero-drift' : ''].join(' ')}
                style={{ '--hero-pos': slide.position } as CSSProperties}
              >
                <HeroPicture
                  src={slide.src}
                  className="home-hero-img"
                  priority={i === 0}
                  sizes={`(max-width: 1023px) max(100vw, ${Math.ceil(STACKED_BOX_HEIGHT * aspect)}px), max(100vw, calc(${DESKTOP_HEIGHT_VW}vw * ${aspect}))`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* One localised scrim (NOS Design ruling A4): from 1024px it covers the copy column only and the rest
          is bare photograph; below that the copy fills the width, so it is an even wash (globals.css). */}
      <div aria-hidden="true" data-hero-scrim="copy" className="absolute inset-0" />

      {/* The wider copy column keeps the headline compact and accommodates three CTAs. */}
      <div data-hero-copy
        className="saoc-container pointer-events-none relative z-10 w-full">
        <div className="pointer-events-auto flex flex-col items-start text-left">
          <span
            data-hero-eyebrow
            className="rounded-full border border-ivory/30 bg-white/10 font-mono uppercase tracking-[0.22em] text-ivory"
          >
            SINCE 1968 · BLOEMFONTEIN
          </span>

          <h1
            id={HEADING_ID}
            className="h1 font-serif font-light leading-[1.02] tracking-[-0.015em] text-ivory"
          >
            The national home of <em>orchid culture</em> in South Africa.
          </h1>

          <div
            data-hero-ctas
            className="grid w-full grid-cols-1"
          >
            <div className="flex min-w-0 flex-col">
              <Link
                href="/societies"
                data-hero-cta="primary"
                className={`${HERO_CTA_BASE} border-ivory bg-ivory text-primary hover:border-bone hover:bg-bone`}
              >
                Find your society
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
              </Link>
              {societyCount != null ? (
                <div className="flex flex-col">
                  <span aria-hidden="true" className="h-[2px] w-6 bg-accent" />
                  <p className={HERO_CTA_META}>{societyCount} societies across South Africa</p>
                </div>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col">
              <a
                href={nosUrl('/')}
                data-hero-cta="secondary"
                className={`${HERO_CTA_BASE} border-ivory text-ivory hover:bg-ivory/10`}
              >
                {showCtaLabel}
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
              </a>
              {showDates ? (
                <div className="flex flex-col">
                  <span aria-hidden="true" className="h-[2px] w-6 bg-accent" />
                  <p data-home-show-date className={HERO_CTA_META}>{showDates}</p>
                </div>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col">
              <a href={nosUrl('/tickets')} data-hero-cta="tickets" className={`${HERO_CTA_BASE} border-ivory text-ivory hover:bg-ivory/10`}>
                Tickets
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
              </a>
              <div className="flex flex-col">
                <span aria-hidden="true" className="h-[2px] w-6 bg-accent" />
                <p className={HERO_CTA_META}>National Orchid Show</p>
              </div>
            </div>
          </div>

          {/* Pause/Play (WCAG 2.2.2) precedes the indicators in DOM order, after the CTAs. Under reduced
              motion there is no autoplay, so no controls. */}
          {reduceMotion ? null : (
            <div data-hero-controls className="flex items-center gap-1">
              <button
                type="button"
                aria-label={userPaused ? 'Play' : 'Pause'}
                onClick={() => setUserPaused((paused) => !paused)}
                className={`inline-flex items-center justify-center rounded-full border border-ivory/40 text-ivory transition-colors duration-150 hover:bg-ivory/10 ${CONTROL_FOCUS}`}
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
                    className={`flex items-center justify-center ${CONTROL_FOCUS}`}
                  >
                    {/* The hit area is the 44px button; the painted track is 28 by 2. The active one fills
                        brass over the interval, and its end advances the carousel, so Pause holds both. */}
                    <span
                      aria-hidden="true"
                      className="relative block overflow-hidden bg-ivory/40"
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
          )}
        </div>
      </div>

    </section>
  );
}
