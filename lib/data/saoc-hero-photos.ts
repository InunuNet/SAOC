// =============================================================
// SAOC — lib/data/saoc-hero-photos.ts
// The ONE map of which photograph and which crop each SAOC route's hero uses, applied by
// components/ui/RouteHero.tsx. The picks are NOS Design's of 2026-10-25/26 (mission saoc-inner-heroes,
// goldens/crop-map.json): the bloom sits bottom-left (0-44% of the hero) and the copy starts at 52%.
// A name ending in -flip, or a cut such as orchid-violet-about, is a build-time derived source
// (lib/hero-derived-sources.json, scripts/generate-image-variants.mjs): the flip is a file, never a CSS
// transform. `objectPosition` is the ruled crop. A route with `typographic: true` has no photograph
// (the solid sage hero). /events/[slug] has no ruled crop yet: it keeps its photograph and takes the
// shared hero treatment only.
// =============================================================

import derivedSources from '@/lib/hero-derived-sources.json';

export type SaocHeroPhoto =
  | { typographic?: false; src: string; objectPosition: string }
  | { typographic: true };

export const SAOC_HERO_PHOTOS: Readonly<Record<string, SaocHeroPhoto>> = {
  '/about': { src: '/images/orchid-violet-about.jpg', objectPosition: '0% 63%' },
  '/societies': { src: '/images/orchid-purple-flip.jpg', objectPosition: '0% 20%' },
  '/judging': { src: '/images/orchid-purple-flip.jpg', objectPosition: '0% 40%' },
  '/events': { src: '/images/orchid-purple-flip.jpg', objectPosition: '0% 60%' },
  '/sponsors': { src: '/images/orchid-dark-flip.jpg', objectPosition: '0% 100%' },
  '/contact': { src: '/images/orchid-violet-contact.jpg', objectPosition: '0% 80%' },
  // No ruled crop (NOS Design 2026-10-26 is silent): the current photograph and position stand.
  '/events/[slug]': { src: '/images/orchid-dark.jpg', objectPosition: '72% 42%' },
  // Typographic: solid sage, no photograph (HM-7 /404 and /events/submit, HM-6 (b) /societies/[slug]).
  '/societies/[slug]': { typographic: true },
  '/events/submit': { typographic: true },
  '/404': { typographic: true },
  '/members': { typographic: true },
  '/memorandum-of-incorporation': { typographic: true },
  '/media-kit': { typographic: true },
  '/privacy': { typographic: true },
  '/terms': { typographic: true },
  '/refunds': { typographic: true },
};

export function saocHeroPhoto(route: string): SaocHeroPhoto {
  const photo = SAOC_HERO_PHOTOS[route];
  if (!photo) throw new Error(`saocHeroPhoto: no hero photograph mapped for ${route}`);
  return photo;
}

// Pixel size of the originals in public/images that a hero or band uses directly.
const ORIGINAL_SIZES: Readonly<Record<string, readonly [number, number]>> = {
  '/images/orchid-dark.jpg': [5184, 3456],
  '/images/orchid-purple.jpg': [5308, 4160],
  '/images/orchid-violet.jpg': [7327, 4885],
};
const ASPECT_PRECISION = 1000;

/**
 * Width over height of a hero source file: a derived cut from its manifest rect, an original from its
 * pixel size. Rounded UP to 3 places, so a `sizes` computed from it never requests a hair too little.
 * The callers derive `sizes` from it (a height-driven cover box needs boxHeight x aspect, not 100vw).
 */
export function heroSourceAspect(src: string): number {
  const cut = derivedSources.find((entry) => `/images/${entry.name}.jpg` === src);
  const size = cut
    ? ([cut.rect.x1 - cut.rect.x0, cut.rect.y1 - cut.rect.y0] as const)
    : ORIGINAL_SIZES[src];
  if (!size) throw new Error(`heroSourceAspect: no pixel size known for ${src}`);
  return Math.ceil((size[0] / size[1]) * ASPECT_PRECISION) / ASPECT_PRECISION;
}
