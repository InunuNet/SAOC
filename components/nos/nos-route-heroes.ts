// =============================================================
// NOS — components/nos/nos-route-heroes.ts
// The h1 and lede of the NOS routes whose loading.tsx renders the same NosHero as its page, so the
// loader and the page cannot drift apart and nothing pops in when the page streams (nos-loader-h1).
// Texts are the pages' own, moved here verbatim.
// =============================================================

import { SYMPOSIUM_THEME_LINE, SYMPOSIUM_TITLE } from '@/lib/data/show-page-presentation';

export interface NosRouteHero {
  route: string;
  title: string;
  lede?: string;
}

export const NOS_ROUTE_HEROES = {
  workshops: {
    route: '/national-show/workshops',
    title: 'Workshops',
  },
  conferences: {
    route: '/national-show/conferences',
    title: 'Conference registration',
  },
  symposium: {
    route: '/national-show/symposium',
    title: SYMPOSIUM_TITLE,
    lede: SYMPOSIUM_THEME_LINE,
  },
  wosaConference: {
    route: '/national-show/wosa-conference',
    title: 'WOSA Conference',
  },
} as const satisfies Record<string, NosRouteHero>;
