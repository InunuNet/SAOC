'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SanityImageSource } from '@sanity/image-url';

import { heroImages as staticHeroImages } from '@/lib/data';
import { urlFor } from '@/sanity/lib/image';

const CAROUSEL_INTERVAL_MS = 5500;

interface HeroSlide {
  src: string;
  alt: string;
  key: string;
}

export interface HeroProps {
  images?: SanityImageSource[] | null;
}

export function Hero({ images }: HeroProps) {
  const slides: HeroSlide[] =
    images && images.length > 0
      ? images.map((img, i) => ({
          key: `sanity-${i}`,
          src: urlFor(img).width(1600).url(),
          alt: '', // decorative — heroImages have no alt field
        }))
      : staticHeroImages.map((img) => ({ key: img.name, src: img.path, alt: img.alt }));

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % (slides.length || 1));
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative min-h-[720px] flex items-center overflow-hidden bg-primary">
      {/* Crossfade image stack */}
      {slides.map((slide, i) => (
        <div
          key={slide.key}
          aria-hidden="true"
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
        className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/40 to-transparent"
      />

      {/* Content */}
      <div className="relative z-10 w-full px-8 md:px-16 py-24 flex flex-col items-center text-center max-w-[1280px] mx-auto">
        {/* Eyebrow pill */}
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ivory rounded-full border border-ivory/30 bg-white/10 px-4 py-1.5 mb-8">
          SINCE 1968 · BLOEMFONTEIN
        </span>

        {/* Headline */}
        <h1 className="h1 on-dark font-serif text-[clamp(54px,7vw,96px)] font-medium leading-[1.04] tracking-[-0.012em] text-ivory max-w-[18ch] mb-6">
          The national home of <em>orchid culture</em> in South Africa.
        </h1>

        {/* Lede */}
        <p className="font-sans text-[20px] leading-[1.5] text-ivory/75 max-w-[52ch] mb-10">
          Connecting twenty-one affiliated societies and their members across South Africa.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-4 justify-center mb-10">
          <Link
            href="/societies"
            className="font-mono text-[11px] uppercase tracking-[0.18em] bg-accent text-ivory px-6 py-3 hover:bg-accent-soft transition-colors duration-150"
          >
            Find your society →
          </Link>
          <Link
            href="/show"
            className="font-mono text-[11px] uppercase tracking-[0.18em] border border-ivory/50 text-ivory px-6 py-3 hover:bg-ivory/10 transition-colors duration-150"
          >
            19th National Show, 2027
          </Link>
        </div>

        {/* Dot indicators */}
        <div className="flex gap-3" role="tablist" aria-label="Carousel navigation">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              role="tab"
              aria-label={`Image ${i + 1}`}
              aria-selected={activeIdx === i}
              onClick={() => setActiveIdx(i)}
              className="h-[2px] transition-all duration-300"
              style={{
                width: activeIdx === i ? '24px' : '24px',
                backgroundColor: activeIdx === i ? 'var(--accent)' : 'rgba(244, 243, 236, 0.40)',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
