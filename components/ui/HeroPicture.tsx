// =============================================================
// SAOC — components/ui/HeroPicture.tsx
// The full-bleed hero photograph as an AVIF-first <picture> with a WebP <img> fallback (mission
// saoc-design-consistency F1d, SA-9). next/image cannot do this: the custom loader
// (lib/image-loader.ts) ignores images.formats, so it only ever emits WebP. The variants are the
// pre-generated hero (q88) set, AVIF and WebP over the same widths.
// The priority hero is the page's one LCP image: fetchpriority=high, never lazy, and a matching
// preload (the AVIF srcset and sizes, byte-for-byte the <source>'s) in <head>. Any other hero
// image (the home carousel's later slides) is lazy with no priority.
// It fills its positioned parent, like next/image `fill`.
// A Client Component on purpose: preload() in a Server Component also fires while Next serialises a
// route's not-found tree into the flight payload, which put the 404 hero's preload in every page's <head>.
// In a Client Component it runs only for the hero that is really rendered into the HTML.
// =============================================================

'use client';

import { preload } from 'react-dom';
import type { CSSProperties } from 'react';
import { heroVariantSrcSet, heroVariantUrl } from '@/lib/image-loader';

interface HeroPictureProps {
  /** A hero source path in public/images (listed in lib/hero-source-widths.json). */
  src: string;
  /** The `sizes` of the hero box; the same string is used on the <source>s, the <img> and the preload. */
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  /** The page's LCP image: high fetch priority, eager, preloaded. Exactly one per page. */
  priority?: boolean;
}

// The width the <img> src falls back to when a browser reads neither srcset: the first variant at or above it.
const FALLBACK_WIDTH = 1200;
const FILL_CLASS = 'absolute inset-0 h-full w-full';

export function HeroPicture({ src, sizes, className, style, priority = false }: HeroPictureProps) {
  const avifSet = heroVariantSrcSet(src, 'avif');
  const webpSet = heroVariantSrcSet(src, 'webp');
  if (avifSet === null || webpSet === null) {
    throw new Error(`HeroPicture: ${src} is not a hero source (lib/hero-source-widths.json)`);
  }
  const fallbackAvif = heroVariantUrl(src, FALLBACK_WIDTH, 'avif');
  if (priority) {
    preload(fallbackAvif, {
      as: 'image',
      imageSrcSet: avifSet,
      imageSizes: sizes,
      type: 'image/avif',
      fetchPriority: 'high',
    });
  }
  return (
    <picture>
      <source type="image/avif" srcSet={avifSet} sizes={sizes} />
      <source type="image/webp" srcSet={webpSet} sizes={sizes} />
      <img
        src={heroVariantUrl(src, FALLBACK_WIDTH, 'webp')}
        srcSet={webpSet}
        sizes={sizes}
        alt=""
        data-nimg="fill"
        aria-hidden="true"
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        className={`${FILL_CLASS} ${className ?? ''}`.trim()}
        style={style}
      />
    </picture>
  );
}
