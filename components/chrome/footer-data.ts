// =============================================================
// SAOC — components/chrome/footer-data.ts
// The one home of the site footer's copy and link lists. Footer.tsx (SAOC skin)
// and components/nos-chrome/NosFooter.tsx (NOS skin) both render from here, so
// the two skins can never carry different words.
// =============================================================

export const FOOTER_ORG_NAME = 'South African Orchid Council';

export const FOOTER_NAV = [
  { id: 'about', label: 'About', href: '/about' },
  { id: 'societies', label: 'Societies', href: '/societies' },
  { id: 'judging', label: 'Judging & Awards', href: '/judging' },
  { id: 'show', label: 'National Show', href: '/national-show' },
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

export const FOOTER_WOSA = {
  heading: 'Looking for wild orchids?',
  linkLabel: 'Visit Wild Orchids of Southern Africa →',
  href: 'https://wildorchids.co.za',
};

export const FOOTER_LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/constitution', label: 'Constitution' },
  { href: '/media-kit', label: 'Media kit' },
];

/** The footer grid, brand column and bottom bar, shared by both skins so the NOS footer keeps the SAOC layout (r20). */
export const FOOTER_LAYOUT = {
  grid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 py-16 px-8 max-w-[1280px] mx-auto',
  brandColumn: 'flex flex-col gap-4',
  brandMark: 'mb-4 flex justify-center',
  bar: 'mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-8 py-4 flex-wrap',
  legal: 'flex items-center gap-4 flex-wrap',
};

/** Text that follows "© {year}" in the copyright line. */
export const FOOTER_COPYRIGHT_TAIL = ` ${FOOTER_ORG_NAME}. All rights reserved.`;
