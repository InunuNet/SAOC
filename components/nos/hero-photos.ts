// =============================================================
// NOS — components/nos/hero-photos.ts
// The ONE map of which NOS route owns which photograph.
//
// Hub: the hub's full-bleed photograph (NOS Design R29, CONFIRMED map).
//
// Inner routes (NOS Design NH3 final, PR-B inputs 2026-10-24): each route shows one of seven
// crops, cut from the original studio photographs to public/images/nos-hero-<code>.jpg
// (rects in .agent/memory/project/specs/nos-pagehero/goldens/crop-map.json). The route table maps
// the internal route to its crop code and heroCropFor() resolves a sub-route by longest path
// prefix, so /vendors/apply inherits /vendors. A crop is used at most once within a menu
// group (G3). A route with no crop and no inheritable prefix gets the typographic hero (G6),
// never a random or repeated crop. The 13-photo Ormerod set in branding/ is NOT rights-cleared
// (guardrail D5).
// =============================================================

export interface NosHeroPhoto {
  src: string;
  /**
   * The photograph's focal point (NosHero passes it to the CSS as `--nos-hero-pos`). The hub's
   * mock `object-position: 68% 50%` lives in the hero CSS; inner crops sit at 50% 50%.
   */
  objectPosition?: string;
}

export const HERO_PHOTOS: Readonly<Record<string, NosHeroPhoto>> = {
  '/national-show': { src: '/images/orchid-dark.jpg', objectPosition: '68% 50%' },
};

export type NosCropCode = 'S3a' | 'S3b' | 'S2a' | 'S2c' | 'S1b' | 'H4a' | 'H4b';

export const HERO_CROPS: Readonly<Record<NosCropCode, NosHeroPhoto>> = {
  S3a: { src: '/images/nos-hero-S3a.jpg' },
  S3b: { src: '/images/nos-hero-S3b.jpg' },
  S2a: { src: '/images/nos-hero-S2a.jpg' },
  S2c: { src: '/images/nos-hero-S2c.jpg' },
  S1b: { src: '/images/nos-hero-S1b.jpg' },
  H4a: { src: '/images/nos-hero-H4a.jpg' },
  H4b: { src: '/images/nos-hero-H4b.jpg' },
};

export const ROUTE_CROPS: Readonly<Record<string, NosCropCode>> = {
  '/national-show/about': 'S3a',
  '/national-show/what-to-expect': 'S2a',
  '/national-show/plan-your-visit': 'S1b',
  '/national-show/faq': 'H4b',
  '/national-show/programme': 'H4a',
  '/national-show/workshops': 'S2c',
  '/national-show/symposium': 'S3b',
  '/national-show/wosa-conference': 'S2a',
  '/national-show/conferences': 'H4b',
  '/national-show/sa-exhibitors': 'S2c',
  '/national-show/international-guests': 'S3b',
  '/national-show/exhibitors': 'H4a',
  '/national-show/vendors': 'S1b',
  '/national-show/sponsors': 'S2a',
  '/national-show/archive': 'H4b',
  '/national-show/contact': 'S1b',
  '/national-show/media-kit': 'S2c',
  '/tickets': 'S3a',
  '/privacy': 'S2a',
  '/terms': 'S2a',
  '/refunds': 'S2a',
  '/newsletter/unsubscribe': 'S2a',
};

export function heroPhotoFor(route: string): NosHeroPhoto | null {
  return HERO_PHOTOS[route] ?? null;
}

/** The inner-hero crop for a route: the longest mapped path prefix wins; null means the typographic hero. */
export function heroCropFor(route: string): NosHeroPhoto | null {
  let bestPrefix: string | null = null;
  for (const prefix of Object.keys(ROUTE_CROPS)) {
    const matches = route === prefix || route.startsWith(`${prefix}/`);
    if (matches && (bestPrefix === null || prefix.length > bestPrefix.length)) bestPrefix = prefix;
  }
  return bestPrefix === null ? null : HERO_CROPS[ROUTE_CROPS[bestPrefix]];
}
