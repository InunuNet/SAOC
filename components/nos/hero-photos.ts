// =============================================================
// NOS — components/nos/hero-photos.ts
// The ONE map of which NOS route owns which stock photograph (NOS Design R29, CONFIRMED
// map, mirrored in .agent/memory/project/specs/nos-own-brand-chrome/goldens/f3/
// hero-photo-map.json — F3-R29 imagery fails on whichever side is stale).
//
// Each of the five rights-cleared photographs is used on exactly one route, once. A route
// with no entry here has a typographic hero. Only these five files may ever reach NosHero:
// the 13-photo Ormerod set in branding/ is NOT rights-cleared (guardrail D5).
// =============================================================

export interface NosHeroPhoto {
  src: string;
  /**
   * The photograph's focal point in the stacked hero below 768px (NosHero passes it to the CSS
   * as `--nos-hero-pos`), measured from the pixels: the position that keeps the most bloom mass in
   * the 390px-wide hero crop (goldens/measure-bloom.py, bloom-marginals.json). At 768px and up
   * the hero CSS keeps its own positions; the hub's mock `object-position: 68% 50%` lives there.
   */
  objectPosition?: string;
}

export const HERO_PHOTOS: Readonly<Record<string, NosHeroPhoto>> = {
  // NOS Design hero ruling (2026-10-23): the hub opens on H4 so the two homes never share a photograph.
  '/national-show': { src: '/images/orchid-purple.jpg', objectPosition: '50% 26%' },
  '/national-show/plan-your-visit': { src: '/images/orchid-yellow.jpg', objectPosition: '50% 99%' },
  '/national-show/symposium': { src: '/images/orchid-violet.jpg', objectPosition: '50% 98%' },
  '/national-show/programme': { src: '/images/orchid-dark.jpg', objectPosition: '70% 30%' },
  '/national-show/what-to-expect': { src: '/images/orchid-pink.jpg', objectPosition: '50% 63%' },
};

export function heroPhotoFor(route: string): NosHeroPhoto | null {
  return HERO_PHOTOS[route] ?? null;
}
