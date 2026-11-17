// Brad's 18 Nov instruction replaces the two-slide ruling: five slides, each slowly zooming in from
// the whole flower toward its detail. The slides use the handoff sources at full resolution, not Sanity
// heroImages. `position` sets both object-position and the zoom's transform-origin.

export interface HomeHeroSlide {
  key: string;
  src: string;
  /** The slide group's accessible label and the dot labels. The photograph itself is decorative (alt=""). */
  alt: string;
  position: string;
}

export const HOME_HERO_SLIDES: readonly HomeHeroSlide[] = [
  {
    key: 'zygopetalum',
    src: '/images/heroes/hero-home-1-zygopetalum-hendrik.jpg',
    alt: 'Zygopetalum orchid',
    position: '50% 45%',
  },
  {
    key: 'dendrobium-chlorostylum',
    src: '/images/heroes/hero-home-2-dendrobium-chlorostylum.jpg',
    alt: 'Dendrobium orchid',
    position: '50% 50%',
  },
  {
    key: 'colmanara',
    src: '/images/heroes/hero-home-3-colmanara-hendrik.jpg',
    alt: 'Colmanara orchid',
    position: '40% 40%',
  },
  {
    key: 'cattleya-white',
    src: '/images/heroes/hero-home-4-cattleya-white.jpg',
    alt: 'Cattleya orchid',
    position: '45% 45%',
  },
  {
    key: 'dendrobium-pair',
    src: '/images/heroes/hero-home-5-dendrobium-hendrik.jpg',
    alt: 'Dendrobium orchid',
    position: '55% 50%',
  },
];
