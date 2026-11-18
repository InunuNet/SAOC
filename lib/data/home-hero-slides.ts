// Brad's 18 Nov instruction: eight full-resolution slides with a subtle automatic zoom.
// `position` sets both object-position and the zoom's transform-origin.

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
    key: 'cymbidium',
    src: '/images/heroes/hero-home-2-cymbidium-hendrik.jpg',
    alt: 'Cymbidium orchid',
    position: '50% 40%',
  },
  {
    key: 'colmanara',
    src: '/images/heroes/hero-home-3-colmanara-hendrik.jpg',
    alt: 'Colmanara orchid',
    position: '40% 40%',
  },
  {
    key: 'paphiopedilum-rust',
    src: '/images/heroes/hero-home-6-paphiopedilum-rust.jpg',
    alt: 'Paphiopedilum orchid',
    position: '50% 40%',
  },
  {
    key: 'dendrobium-pair',
    src: '/images/heroes/hero-home-5-dendrobium-hendrik.jpg',
    alt: 'Dendrobium orchid',
    position: '55% 50%',
  },
  {
    key: 'paphiopedilum-yellow',
    src: '/images/heroes/hero-home-4-paphiopedilum-yellow.jpg',
    alt: 'Paphiopedilum orchid',
    position: '50% 45%',
  },
  {
    key: 'phalaenopsis-pink',
    src: '/images/heroes/hero-home-7-phalaenopsis-pink.jpg',
    alt: 'Phalaenopsis orchid',
    position: '55% 45%',
  },
  {
    key: 'cymbidium-amber',
    src: '/images/heroes/hero-home-8-cymbidium-amber-hendrik.jpg',
    alt: 'Cymbidium orchid',
    position: '50% 40%',
  },
];
