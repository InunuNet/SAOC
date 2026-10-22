// =============================================================
// SAOC — components/chrome/footer-data.ts
// The footer's shared copy, layout and rhythm, plus the SAOC site's own link lists. Footer.tsx
// (SAOC skin) and components/nos-chrome/NosFooter.tsx (NOS skin) both render the shared parts
// from here, so the two skins can never carry different words; the NOS link lists live in
// components/nos-chrome/nos-footer-data.ts (nos-site-split F3, NOS Design R3.7).
// =============================================================

import { nosUrl } from '@/lib/site-hosts';

export const FOOTER_ORG_NAME = 'South African Orchid Council';

export const FOOTER_NAV: ReadonlyArray<{
  id: string;
  label: string;
  href: string;
  /** Leaves for the NOS site: a plain anchor, same tab, no arrow. */
  crossSite?: boolean;
}> = [
  { id: 'about', label: 'About', href: '/about' },
  { id: 'societies', label: 'Societies', href: '/societies' },
  { id: 'judging', label: 'Judging & Awards', href: '/judging' },
  { id: 'show', label: 'National Show', href: nosUrl('/'), crossSite: true },
  { id: 'events', label: 'Events', href: '/events' },
];

export const FOOTER_HEADINGS = {
  explore: 'Explore',
  partners: 'Partners',
  touch: 'Stay in touch',
};

/** The footer column rhythm, shared by both skins (r20 F4, Codi FINAL 2026-10-22): one list, one 44px row; the skin adds its own type and colour. */
export const FOOTER_RHYTHM = {
  list: 'flex flex-col',
  row: 'inline-flex min-h-11 items-center text-[14px]',
};

export const FOOTER_REG = 'REG# 1978/004040/08   NPO 043-901';

export const FOOTER_BULLETIN = {
  blurb: 'Quarterly bulletin — show dates, judging results and yearbook news.',
  emailLabel: 'Email address',
  placeholder: 'your@email.co.za',
  submitLabel: 'Subscribe',
};

/** The Wild Orchids of Southern Africa link, once per footer: the first Partner on SAOC, the credit column on NOS. */
export const FOOTER_WOSA = {
  label: 'Wild Orchids of Southern Africa',
  href: 'https://wildorchids.co.za',
};

/** Screen-reader cue for a link that opens in a new tab; the visible mark is the arrow. */
export const FOOTER_NEW_TAB_CUE = '(opens in a new tab)';

// The SAOC site's legal row. Media kit is the SAOC media kit (members only).
export const FOOTER_LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/constitution', label: 'Constitution' },
  { href: '/media-kit', label: 'Media kit' },
];

/**
 * The footer grid, brand column and bottom bar, shared by both skins so the NOS footer keeps the SAOC
 * layout (r20). From 1280px the grid is three content-width tracks and the 300px sign-up, spread
 * edge to edge, so the three gaps are equal by construction and the outer edges sit on the container
 * (NOS Design FT1). The brand block hugs its content and aligns with the copyright line (FT2).
 */
export const FOOTER_LAYOUT = {
  grid: 'grid grid-cols-1 gap-x-8 gap-y-12 py-16 px-8 max-w-[1280px] mx-auto md:grid-cols-2 min-[1280px]:grid-cols-[auto_auto_auto_300px] min-[1280px]:justify-between',
  brandColumn: 'flex w-fit flex-col items-center gap-4',
  brandMark: 'flex justify-center',
  bar: 'mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-8 py-4 flex-wrap',
  legal: 'flex items-center gap-4 flex-wrap',
};

/** Text that follows "© {year}" in the copyright line. */
export const FOOTER_COPYRIGHT_TAIL = ` ${FOOTER_ORG_NAME}. All rights reserved.`;
