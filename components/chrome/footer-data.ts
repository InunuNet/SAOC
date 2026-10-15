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
  { id: 'members', label: 'Members Portal', href: '/members' },
];

export const FOOTER_HEADINGS = {
  explore: 'Explore',
  partners: 'Partners',
  touch: 'Stay in touch',
};

export const FOOTER_BRAND_TEXT =
  'A national coordinating body for affiliated orchid societies across South Africa — promoting culture, hybridisation and appreciation of orchids in cultivation since 1968.';

export const FOOTER_REG = 'REG# 1978/004040/08   NPO 043-901';

export const FOOTER_BULLETIN = {
  blurb: 'Quarterly bulletin — show dates, judging results and yearbook news.',
  emailLabel: 'Email address',
  placeholder: 'your@email.co.za',
  submitLabel: 'Subscribe',
};

export const FOOTER_WOSA = {
  heading: 'Looking for wild orchids?',
  linkLabel: 'Visit Wild Orchids of Southern Africa →',
  href: 'https://wildorchids.co.za',
};

export const FOOTER_LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/constitution', label: 'Constitution' },
  { href: '/media-kit', label: 'Media kit' },
];

/** Text that follows "© {year}" in the copyright line. */
export const FOOTER_COPYRIGHT_TAIL = ` ${FOOTER_ORG_NAME}. All rights reserved.`;
