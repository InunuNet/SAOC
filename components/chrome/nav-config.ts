// =============================================================
// SAOC — components/chrome/nav-config.ts
// Site-wide primary nav structure. Header.tsx and MobileMenu.tsx both
// consume this — neither hardcodes nav items or ticket destination hrefs.
//
// The "National Show" item is a `mega` item whose Tickets column is a
// plain data array (NavColumn.links) so a future mission can append
// Conferences / Workshops & Field Trips entries here without touching
// Header.tsx, MegaMenu.tsx, or MobileMenu.tsx.
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
  | { type: 'link'; id: string; label: string; href: string; disabled?: boolean }
  | { type: 'mega'; id: string; label: string; href: string; columns: NavColumn[] };

export const NAV: readonly NavItem[] = [
  { type: 'link', id: 'about', label: 'About', href: '/about' },
  { type: 'link', id: 'societies', label: 'Societies', href: '/societies' },
  { type: 'link', id: 'judging', label: 'Judging & Awards', href: '/judging' },
  {
    type: 'mega',
    id: 'show',
    label: 'National Show',
    href: '/national-show',
    columns: [
      {
        id: 'tickets',
        heading: 'Tickets',
        headingHref: '/national-show/tickets',
        links: [
          { id: 'visitor', label: 'Visitor Tickets', href: '/tickets' },
          { id: 'exhibitor', label: 'Exhibitor Entry', href: '/national-show/exhibitors' },
          { id: 'vendor', label: 'Vendor Registration', href: '/national-show/vendors/register' },
          { id: 'conferences', label: 'Conferences', href: '/national-show/conferences' },
          { id: 'workshops', label: 'Workshops & Field Trips', href: '/national-show/workshops' },
        ],
      },
    ],
  },
  { type: 'link', id: 'events', label: 'Events', href: '/events' },
  { type: 'link', id: 'learn', label: 'Learn', href: '#', disabled: true },
];
