// =============================================================
// SAOC — lib/data/saoc-hero-photos.ts
// The ONE map of which photograph and which crop each SAOC route's hero uses (critique fix 4,
// 2026-10-25), modelled on components/nos/hero-photos.ts. Only the five hero sources in
// public/images are used. Routes that sit next to each other in the primary nav (About, Societies,
// Judging, Events, then Sponsors, Contact) never share a photograph, and no route's crop repeats
// its neighbour's. `objectPosition` is read off the sharp region of each source: the in-focus
// blooms, not the blurred ground. The hero box is a wide band, so only the vertical band that
// holds those blooms is shown at 1440 and 2056.
// =============================================================

export interface SaocHeroPhoto {
  src: string;
  /** CSS object-position of the cropped band. */
  objectPosition: string;
}

const VIOLET = '/images/orchid-violet.jpg';
const PURPLE = '/images/orchid-purple.jpg';
const DARK = '/images/orchid-dark.jpg';
const PINK = '/images/orchid-pink.jpg';
const YELLOW = '/images/orchid-yellow.jpg';

export const SAOC_HERO_PHOTOS: Readonly<Record<string, SaocHeroPhoto>> = {
  // Primary nav, in nav order: neighbours share neither a photograph nor a crop.
  '/about': { src: VIOLET, objectPosition: '52% 42%' },
  '/societies': { src: PINK, objectPosition: '50% 38%' },
  '/judging': { src: DARK, objectPosition: '72% 42%' },
  '/events': { src: PURPLE, objectPosition: '52% 33%' },
  '/sponsors': { src: YELLOW, objectPosition: '38% 58%' },
  '/contact': { src: VIOLET, objectPosition: '62% 8%' },
  // Pages one level under a nav page take a different photograph from their parent.
  '/societies/[slug]': { src: PURPLE, objectPosition: '28% 42%' },
  '/events/[slug]': { src: DARK, objectPosition: '72% 42%' },
  '/events/submit': { src: PURPLE, objectPosition: '80% 45%' },
  // Footer and utility pages.
  '/members': { src: PINK, objectPosition: '50% 62%' },
  '/memorandum-of-incorporation': { src: DARK, objectPosition: '20% 45%' },
  '/media-kit': { src: PURPLE, objectPosition: '80% 45%' },
  '/privacy': { src: PURPLE, objectPosition: '80% 45%' },
  '/terms': { src: YELLOW, objectPosition: '38% 58%' },
  '/refunds': { src: VIOLET, objectPosition: '52% 42%' },
  '/404': { src: DARK, objectPosition: '72% 42%' },
};

export function saocHeroPhoto(route: string): SaocHeroPhoto {
  const photo = SAOC_HERO_PHOTOS[route];
  if (!photo) throw new Error(`saocHeroPhoto: no hero photograph mapped for ${route}`);
  return photo;
}
