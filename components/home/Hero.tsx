'use client';

import Link from 'next/link';
import { useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';
import type { SanityImageSource } from '@sanity/image-url';

import { HeroPicture } from '@/components/ui/HeroPicture';
import { HOME_HERO_SLIDES } from '@/lib/data/home-hero-slides';
import { heroSourceAspect } from '@/lib/data/saoc-hero-photos';
import { formatShowDateRange, showLabelWithEdition, showYearOf } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';
import { nosUrl } from '@/lib/site-hosts';

const CAROUSEL_INTERVAL_MS = 7000;
const FADE_MS = 1400;
const HEADING_ID = 'home-hero-heading';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FINE_HOVER_QUERY = '(hover: hover) and (pointer: fine)';

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function subscribeFineHover(onChange: () => void): () => void {
  const query = window.matchMedia(FINE_HOVER_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function slideLabel(index: number, total: number, subject: string): string {
  return `${index + 1} of ${total}${subject ? `: ${subject}` : ''}`;
}

const HERO_CTA_BASE =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 border px-6 py-3 font-sans text-[14px] font-medium transition-colors duration-150 sm:w-auto outline-ivory focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px]';

// The full-bleed hero's box is at least the 860px min-height of .home-hero (globals.css), so a source wider
// than 860px x its aspect is height-driven and `sizes` must say so.
const HERO_BOX_HEIGHT = 860;
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
}

export function Hero({ show }: HeroProps) {
  const showYear = showYearOf(show?.showDate);
  const showCtaLabel = `${showLabelWithEdition(show?.edition)}${showYear ? `, ${showYear}` : ''}`;
  const showDates = formatShowDateRange(show?.showDate, show?.showEndDate);
  const slides = HOME_HERO_SLIDES;

  const [activeIdx, setActiveIdx] = useState(0);
  const [leavingIdx, setLeavingIdx] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [readyDetails, setReadyDetails] = useState<readonly string[]>([]);
  const detailRequests = useRef(new Map<string, Promise<void>>());
  const hoverFrame = useRef<number | null>(null);
  const zoomRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activationCounts, setActivationCounts] = useState(() => slides.map(() => 0));
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // WCAG 2.2.2: autoplay stops under prefers-reduced-motion, and follows live changes.
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
  const fineHover = useSyncExternalStore(
    subscribeFineHover,
    () => window.matchMedia(FINE_HOVER_QUERY).matches,
    () => false,
  );
  const hoverEnabled = fineHover && !reduceMotion;
  const autoPaused = hoverEnabled && hoveredIdx === activeIdx && !!slides[activeIdx].detailSrc;

  const loadDetail = (src: string) => {
    if (detailRequests.current.has(src)) return;
    const image = new Image();
    const request = new Promise<void>((resolve, reject) => {
      image.onload = () => {
        image.decode().then(resolve, reject);
      };
      image.onerror = reject;
      image.src = src;
    });
    detailRequests.current.set(src, request);
    request.then(
      () => setReadyDetails((ready) => ready.includes(src) ? ready : [...ready, src]),
      () => detailRequests.current.delete(src),
    );
  };

  const onPhotoMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!hoverEnabled || !slides[activeIdx].detailSrc) return;
    const zoom = zoomRefs.current[activeIdx];
    if (!zoom) return;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
    const y = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
    if (hoverFrame.current !== null) cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = requestAnimationFrame(() => {
      zoom.style.transformOrigin = `${x}% ${y}%`;
      hoverFrame.current = null;
    });
  };

  // Keep the outgoing zoom running through its fade; remount an image on reactivation so it starts wide.
  const goTo = (next: number) => {
    if (next === activeIdx) return;
    clearTimeout(leaveTimer.current);
    setHoveredIdx(null);
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
      data-paused={userPaused || autoPaused ? '' : undefined}
      className="home-hero relative isolate flex flex-col overflow-hidden bg-primary-800 on-dark lg:flex-row lg:items-center"
      style={{ '--hero-interval': `${CAROUSEL_INTERVAL_MS}ms` } as CSSProperties}
    >
      {/* Crossfade image stack: opacity, plus a slow zoom on the slide that is showing.
          Up to 1023px the hero stacks: this is a 2/1 band with nothing over it and the copy sits under
          it on solid sage; from 1024px it is the full-bleed background of the copy. */}
      <div
        data-home-hero-media
        className="relative aspect-[2/1] w-full overflow-hidden lg:absolute lg:inset-0 lg:aspect-auto"
      >
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
                ref={(node) => { zoomRefs.current[i] = node; }}
                className="home-hero-hover absolute inset-0"
                data-zoomed={hoverEnabled && hoveredIdx === i && !!slide.detailSrc ? '' : undefined}
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
                    sizes={`(max-width: 1023px) max(100vw, calc(50vw * ${aspect})), max(100vw, ${Math.ceil(HERO_BOX_HEIGHT * aspect)}px)`}
                  />
                  {slide.detailSrc && readyDetails.includes(slide.detailSrc) ? (
                    <img
                      src={slide.detailSrc}
                      alt=""
                      aria-hidden="true"
                      className="home-hero-img home-hero-detail absolute inset-0 h-full w-full"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {hoverEnabled && slides[activeIdx].detailSrc ? (
          <div
            data-home-hero-photo-hover
            className="absolute inset-0 z-10"
            onPointerEnter={() => {
              setHoveredIdx(activeIdx);
              loadDetail(slides[activeIdx].detailSrc!);
            }}
            onPointerMove={onPhotoMove}
            onPointerLeave={() => {
              if (hoverFrame.current !== null) cancelAnimationFrame(hoverFrame.current);
              hoverFrame.current = null;
              setHoveredIdx(null);
            }}
          />
        ) : null}
      </div>

      {/* One localised scrim (NOS Design ruling A4): it covers the copy column only; the rest is bare photograph. */}
      <div aria-hidden="true" data-hero-scrim="copy" className="absolute inset-0 max-lg:hidden" />

      {/* Content: left-aligned in the container, a 640px column (A3). */}
      <div className="saoc-container pointer-events-none relative z-10 w-full py-10 lg:py-24">
        <div className="pointer-events-auto flex max-w-[640px] flex-col items-start text-left">
          <span className="mb-8 rounded-full border border-ivory/30 bg-white/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-ivory">
            SINCE 1968 · BLOEMFONTEIN
          </span>

          <h1
            id={HEADING_ID}
            className="h1 font-serif font-light text-[clamp(48px,7.4vw,96px)] leading-[1.02] tracking-[-0.015em] text-ivory"
          >
            The national home of <em>orchid culture</em> in South Africa.
          </h1>

          <div
            data-hero-ctas
            className={`flex w-full flex-col gap-4 sm:w-auto sm:flex-row mt-8`}
          >
            <Link
              href="/societies"
              data-hero-cta="primary"
              className={`${HERO_CTA_BASE} border-ivory bg-ivory text-primary hover:bg-bone hover:border-bone`}
            >
              Find your society
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
            <div className="flex flex-col gap-2 sm:items-start">
              <a
                href={nosUrl('/')}
                data-hero-cta="secondary"
                className={`${HERO_CTA_BASE} border-ivory text-ivory hover:bg-ivory/10`}
              >
                {showCtaLabel}
              </a>
              {showDates ? (
                <p data-home-show-date className="font-sans text-[15px] leading-[1.35] text-ivory">
                  {showDates}
                </p>
              ) : null}
            </div>
          </div>

          {/* Pause/Play (WCAG 2.2.2) precedes the indicators in DOM order, after the CTAs. They sit at the foot of the
              copy column, 56px below the CTAs, so the bloom side of the photograph carries no UI. Under reduced
              motion there is no autoplay, so no controls. */}
          {reduceMotion ? null : (
            <div data-hero-controls className="mt-14 flex items-center gap-1">
              <button
                type="button"
                aria-label={userPaused ? 'Play' : 'Pause'}
                onClick={() => setUserPaused((paused) => !paused)}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-ivory/40 text-ivory transition-colors duration-150 hover:bg-ivory/10 ${CONTROL_FOCUS}`}
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
          )}
        </div>
      </div>

    </section>
  );
}
