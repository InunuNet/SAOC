// The SAOC home hero's slides, in carousel order. NOS Design rulings (hero-cards-ruling A2, 2026-10-23;
// saoc-inner-heroes HS-1, 2026-10-26): two slides, S3 dark (the lead, and the reduced-motion static) then
// orchid purple, the derived cut orchid-purple-home (lib/hero-derived-sources.json). Violet has retired from
// the home, and H4 purple stays out as an uncut original (its black plant clip shows at some widths; the
// derived cut stops above it). The slides are the handoff sources at full resolution, not the Sanity heroImages.
// `position` is the object-position of the slide: from 1024px up in the full-bleed hero, below it in the 2/1
// band the hero stacks into. Re-ordering or swapping a slide is a change to this array only.

export interface HomeHeroSlide {
  key: string;
  src: string;
  /** The slide group's accessible label and the dot labels. The photograph itself is decorative (alt=""). */
  alt: string;
  position: string;
}

export const HOME_HERO_SLIDES: readonly HomeHeroSlide[] = [
  {
    key: 'orchid-dark',
    src: '/images/orchid-dark.jpg',
    alt: 'Dark orchid',
    position: '62% 50%',
  },
  {
    key: 'orchid-purple',
    src: '/images/orchid-purple-home.jpg',
    alt: 'Purple orchid',
    position: '50% 50%',
  },
];
