import type { Society } from '@/types';

// `meet` and `venue` are intentionally omitted below — SAOC has not yet supplied real
// meeting days/times/venues for these societies (see
// docs/leeann-source/society-website-information-form_2026-09-01.md, the intake form
// still awaiting responses). A wrong meeting time or venue is actionable, not just
// inaccurate: it sends a real person to a real building on the wrong night. Do not
// invent replacement values here — leave the fields unset so the UI can render a
// visible "to be confirmed" placeholder instead (see SocietyCard.tsx).
export const societies: Society[] = [
  {
    name: 'Cape Orchid Society',
    region: 'Western Cape',
    province: 'WC',
    founded: 1947,
    members: 220,
  },
  {
    name: 'Natal Orchid Society',
    region: 'KwaZulu-Natal',
    province: 'KZN',
    founded: 1954,
    members: 310,
  },
  {
    name: 'Transvaal Orchid Society',
    region: 'Gauteng',
    province: 'GP',
    founded: 1959,
    members: 280,
  },
  {
    name: 'Northern Transvaal Orchid Society',
    region: 'Tshwane',
    province: 'GP',
    founded: 1962,
    members: 190,
  },
  {
    name: 'East Rand Orchid Society',
    region: 'Ekurhuleni',
    province: 'GP',
    founded: 1974,
    members: 95,
  },
  {
    name: 'West Rand Orchid Society',
    region: 'Krugersdorp',
    province: 'GP',
    founded: 1978,
    members: 72,
  },
  {
    name: 'Lowveld Orchid Society',
    region: 'Mbombela',
    province: 'MP',
    founded: 1981,
    members: 110,
  },
  {
    name: 'Highveld Orchid Society',
    region: 'Witbank',
    province: 'MP',
    founded: 1985,
    members: 48,
  },
  {
    name: 'Free State Orchid Society',
    region: 'Bloemfontein',
    province: 'FS',
    founded: 1970,
    members: 65,
  },
  {
    name: 'Border Orchid Society',
    region: 'East London',
    province: 'EC',
    founded: 1976,
    members: 54,
  },
  {
    name: 'Eastern Province Orchid Society',
    region: 'Gqeberha',
    province: 'EC',
    founded: 1972,
    members: 88,
  },
  {
    name: 'Garden Route Orchid Society',
    region: 'George',
    province: 'WC',
    founded: 1989,
    members: 76,
  },
  {
    name: 'Overberg Orchid Society',
    region: 'Hermanus',
    province: 'WC',
    founded: 1994,
    members: 41,
  },
  {
    name: 'Winelands Orchid Society',
    region: 'Stellenbosch',
    province: 'WC',
    founded: 1998,
    members: 62,
  },
  {
    name: 'Midlands Orchid Society',
    region: 'Pietermaritzburg',
    province: 'KZN',
    founded: 1983,
    members: 84,
  },
  {
    name: 'North Coast Orchid Society',
    region: 'Ballito',
    province: 'KZN',
    founded: 1991,
    members: 58,
  },
  {
    name: 'Kalahari Orchid Society',
    region: 'Kimberley',
    province: 'NC',
    founded: 1988,
    members: 32,
  },
  {
    name: 'Limpopo Orchid Society',
    region: 'Polokwane',
    province: 'LP',
    founded: 1996,
    members: 37,
  },
  {
    name: 'North West Orchid Society',
    region: 'Potchefstroom',
    province: 'NW',
    founded: 1992,
    members: 44,
  },
  {
    name: 'Vaal Triangle Orchid Society',
    region: 'Vanderbijlpark',
    province: 'GP',
    founded: 1986,
    members: 51,
  },
  {
    name: 'South Cape Orchid Society',
    region: 'Mossel Bay',
    province: 'WC',
    founded: 2001,
    members: 36,
  },
];
