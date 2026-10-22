// The SAOC home hero's slides, in carousel order. NOS Design ruling (hero-cards-ruling A2, 2026-10-23):
// exactly three slides, S3 dark (the lead, and the reduced-motion static), S2 violet, H4 purple, driven
// from the handoff sources in public/images at full resolution rather than the Sanity heroImages.
// `position` is the object-position from 768px up; `positionSmall` below it, where the copy sits at the
// bottom and the bloom is held above it. Re-ordering or swapping a slide is a change to this array only.

export interface HomeHeroSlide {
  key: string;
  src: string;
  alt: string;
  position: string;
  positionSmall: string;
}

export const HOME_HERO_SLIDES: readonly HomeHeroSlide[] = [
  {
    key: 'orchid-dark',
    src: '/images/orchid-dark.jpg',
    alt: 'Dark orchid',
    position: '62% 50%',
    positionSmall: '70% 30%',
  },
  {
    key: 'orchid-violet',
    src: '/images/orchid-violet.jpg',
    alt: 'Violet orchid',
    position: '60% 40%',
    positionSmall: '60% 40%',
  },
  {
    key: 'orchid-purple',
    src: '/images/orchid-purple.jpg',
    alt: 'Purple orchid',
    position: '50% 26%',
    positionSmall: '50% 26%',
  },
];
