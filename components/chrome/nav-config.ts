// =============================================================
// SAOC — components/chrome/nav-config.ts
// Site-wide primary nav structure. Header.tsx and MobileMenu.tsx both
// consume this — neither hardcodes nav items or ticket destination hrefs.
//
// Restructured (mission ticketing-complete M3/F6) into the group layout
// negotiated with the National Show session: Visit / Programme / Exhibit &
// Trade are `mega` items (one column each) covering the National-Show-scoped
// destinations; Tickets stands alone as a top-level `link` (the conversion
// path — never nested two clicks deep inside a dropdown); Past Editions is a
// standalone, visually quieter `link` (see `quiet` below). Lee-Ann's six SAOC
// sections (About, Societies, Judging, Events/"Calendar of events", Members
// Portal, and Home via the logo lockup in Header.tsx) stay top-level `link`
// items — her Drive folder's numbering is document order, not information architecture,
// so this file does not mirror it.
//
// SUPERSEDED (2026-09-09, mission site-content-alignment M2/F2): the note above
// was written when only Lee-Ann's 6 SAOC sections were being reconciled
// against nav. That reconciliation now covers all 20 of her sections, SAOC and
// National Show alike — see
// .agent/memory/project/specs/site-content-alignment/goldens/fixtures/f1-coverage-map.json,
// the authoritative section-to-route source of truth (not just this file's
// comment). For the still-open route-gap list, see
// .agent/memory/project/specs/ticketing-complete/goldens/fixtures/f6-pending-nos-routes.json
// rather than restating it here, so the two files can't drift apart.
// =============================================================

export interface NavLeaf {
  id: string;
  label: string;
  href: string;
  disabled?: boolean;
}

export interface NavColumn {
  id: string;
  heading: string;
  headingHref?: string;
  links: NavLeaf[];
}

export type NavItem =
  | { type: 'link'; id: string; label: string; href: string; disabled?: boolean; quiet?: boolean }
  | { type: 'mega'; id: string; label: string; href: string; ctaLabel?: string; columns: NavColumn[] };

export const NAV: readonly NavItem[] = [
  { type: 'link', id: 'about', label: 'About', href: '/about' },
  { type: 'link', id: 'societies', label: 'Societies', href: '/societies' },
  { type: 'link', id: 'judging', label: 'Judging', href: '/judging' },
  { type: 'link', id: 'events', label: 'Events', href: '/events' },
  { type: 'link', id: 'members', label: 'Members Portal', href: '/members' },
  {
    type: 'mega',
    id: 'visit',
    label: 'Visit',
    href: '/national-show/about',
    columns: [
      {
        id: 'visit',
        heading: 'About the Show',
        headingHref: '/national-show/about',
        links: [
          { id: 'what-to-expect', label: 'What to Expect', href: '/national-show/what-to-expect' },
          { id: 'plan-your-visit', label: 'Plan Your Visit', href: '/national-show/plan-your-visit' },
          { id: 'faq', label: 'FAQ', href: '/national-show/faq' },
        ],
      },
    ],
  },
  {
    type: 'mega',
    id: 'programme',
    label: 'Programme',
    href: '/national-show/programme',
    columns: [
      {
        id: 'programme',
        heading: 'Programme of Events',
        headingHref: '/national-show/programme',
        links: [
          { id: 'workshops', label: 'Workshops & Field Trips', href: '/national-show/workshops' },
          { id: 'symposium', label: 'SAOC Symposium', href: '/national-show/symposium' },
          { id: 'wosa-conference', label: 'WOSA Conference', href: '/national-show/wosa-conference' },
        ],
      },
    ],
  },
  {
    type: 'mega',
    id: 'exhibit',
    label: 'Exhibit',
    href: '/national-show/exhibitors',
    // The fuller "Exhibit & Trade" wording (the negotiated group name) carries
    // through here, where there's room for it, rather than on the top-level
    // trigger — see f6-README.md sec on the 1240-1400px wrap fix.
    ctaLabel: 'Exhibit & Trade',
    columns: [
      {
        id: 'exhibit',
        heading: 'South African Exhibitors',
        headingHref: '/national-show/exhibitors',
        links: [
          {
            id: 'intl-exhibitors',
            label: 'International Exhibitors',
            href: '/national-show/exhibitors/international',
          },
          { id: 'vendors', label: 'Vendors', href: '/national-show/vendors' },
        ],
      },
    ],
  },
  { type: 'link', id: 'tickets', label: 'Tickets', href: '/tickets' },
  { type: 'link', id: 'past-editions', label: 'Past Editions', href: '/national-show/archive', quiet: true },
];
