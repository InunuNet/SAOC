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
// 26 Nov 2026 (Brad: the SAOC hero system, zoomed out): the files under /images/heroes/ are full-width
// 2:1 cuts of their originals at native resolution (Hendrik Schoeman's 3000x4000 originals, the Commons
// originals in stock-photos/, and the 3000x2000 home sources for the two phalaenopsis), S3a and D1 mirrored
// so the bloom sits right of the copy. H4b, PK3 and Y1 are their own originals, used whole.
// Variant A (Brad, 26 Nov 2026: lock the height near 268px at 1288): the box is about 4.8:1, so it shows the
// full width and about 42% of each 2:1 file's height; objectPosition puts that band on the bloom.
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
  '/national-show': { src: '/images/heroes/hero-nos-hub-cattleya-white.jpg', objectPosition: '50% 50%' },
};

export type NosCropCode =
  | 'S3a'
  | 'S3b'
  | 'S2a'
  | 'S2c'
  | 'S1b'
  | 'H4a'
  | 'H4b'
  | 'D1'
  | 'PK1'
  | 'PK3'
  | 'Y1';

export const HERO_CROPS: Readonly<Record<NosCropCode, NosHeroPhoto>> = {
  S3a: { src: '/images/heroes/hero-nos-about-colmanara-hendrik.jpg', objectPosition: '50% 50%' },
  S3b: { src: '/images/heroes/hero-nos-programme-dendrobium-hendrik.jpg', objectPosition: '50% 50%' },
  S2a: { src: '/images/heroes/hero-nos-conferences-purple-phalaenopsis.jpg', objectPosition: '50% 25%' },
  S2c: { src: '/images/heroes/hero-nos-workshops-cattleya-apricot-hendrik.jpg', objectPosition: '50% 80%' },
  S1b: { src: '/images/heroes/hero-nos-plan-paphiopedilum-yellow-wide.jpg', objectPosition: '50% 50%' },
  H4a: { src: '/images/heroes/hero-nos-faq-pink-phalaenopsis.jpg', objectPosition: '50% 40%' },
  H4b: { src: '/images/nos-hero-H4b.jpg', objectPosition: '50% 70%' },
  D1: { src: '/images/heroes/hero-nos-symposium-paphiopedilum-rust.jpg', objectPosition: '50% 55%' },
  PK1: { src: '/images/heroes/hero-nos-expect-zygopetalum-hendrik.jpg', objectPosition: '50% 50%' },
  PK3: { src: '/images/nos-hero-PK3.jpg', objectPosition: '50% 60%' },
  Y1: { src: '/images/nos-hero-Y1.jpg', objectPosition: '50% 50%' },
};

export const ROUTE_CROPS: Readonly<Record<string, NosCropCode>> = {
  '/national-show/about': 'S3a',
  '/national-show/what-to-expect': 'PK1',
  '/national-show/plan-your-visit': 'S1b',
  '/national-show/faq': 'H4a',
  '/national-show/photo-credits': 'H4b',
  '/national-show/programme': 'S3b',
  '/national-show/workshops': 'S2c',
  '/national-show/symposium': 'D1',
  '/national-show/wosa-conference': 'PK3',
  '/national-show/conferences': 'S2a',
  '/national-show/sa-exhibitors': 'PK1',
  '/national-show/international-guests': 'Y1',
  '/national-show/plant-entry': 'D1',
  '/national-show/vendors': 'S1b',
  '/national-show/sponsors': 'PK3',
  '/national-show/archive': 'S3a',
  '/national-show/contact': 'H4a',
  '/national-show/media-kit': 'S2c',
  '/tickets': 'S3a',
  '/privacy': 'S3b',
  '/terms': 'S2a',
  '/refunds': 'Y1',
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
