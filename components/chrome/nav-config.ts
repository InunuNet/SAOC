// =============================================================
// SAOC — components/chrome/nav-config.ts
// The SAOC site's primary nav. Header.tsx and MobileMenu.tsx both consume this — neither
// hardcodes nav items.
//
// nos-site-split F3 (NOS Design R3.1): the National Orchid Show is its own site on its own host,
// so the old National Show mega-menu is gone from SAOC. "National Show" is one plain link, in the
// same slot (after Events, before Sponsors), to the NOS home. A link between the two sites is a
// plain anchor in the same tab with no arrow (R0.2), flagged `crossSite` so the renderers emit an
// <a> rather than a client-routed Link. The show's own menu lives in
// components/nos-chrome/nos-nav.ts, in the shapes declared below.
//
// SUPERSEDED (2026-09-09, mission site-content-alignment M2/F2): the section reconciliation this
// file used to describe now covers all 20 of Lee-Ann's sections, SAOC and National Show alike —
// see .agent/memory/project/specs/site-content-alignment/goldens/fixtures/f1-coverage-map.json,
// the authoritative section-to-route source of truth (not just this file's comment).
// =============================================================

import { nosUrl } from '@/lib/site-hosts';

export interface NavLeaf {
  id: string;
  label: string;
  href: string;
  /** Trimmed prefix of the manifest row's own `purpose` field. Never free text. */
  descriptor?: string;
  disabled?: boolean;
}

export interface NavColumn {
  id: string;
  heading: string;
  headingHref?: string | null;
  links: NavLeaf[];
}

/**
 * The show menu's lead block: eyebrow, serif lead linking the hub, a venue/dates
 * meta line, and the folded-in "The Show" group (Tickets / Show Sponsors /
 * Past Shows) — see mission section 1's track table.
 */
export interface NavMegaLead {
  eyebrow: string;
  leadLabel: string;
  leadHref: string;
  /**
   * Venue + dates line. NOT authored here — rendered at render time from the
   * nationalShow Sanity singleton via lib/show-identity.ts. Left unset in the
   * static data; the component fills it in.
   */
  meta?: string;
  theShow: NavColumn;
}

export interface NavMegaFeatureRailDestination {
  id: string;
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

/**
 * NOS-coloured panel (mission menu-system-layout4 M2/F8): mono date meta, serif heading, three
 * destination rows.
 */
export interface NavMegaFeatureRail {
  /** Same render-time-only contract as NavMegaLead.meta. */
  meta?: string;
  heading: string;
  /** Exactly 3 entries, primary first. */
  destinations: NavMegaFeatureRailDestination[];
}

export interface NavLinkItem {
  type: 'link';
  id: string;
  label: string;
  href: string;
  disabled?: boolean;
  quiet?: boolean;
  /** The link leaves this site for the other one: render a plain anchor, same tab, no arrow. */
  crossSite?: boolean;
}

export interface NavMegaItem {
  type: 'mega';
  id: string;
  label: string;
  href: string;
  ctaLabel?: string;
  lead?: NavMegaLead;
  columns: NavColumn[];
  featureRail?: NavMegaFeatureRail;
}

export type NavItem = NavLinkItem | NavMegaItem;

export const NAV: readonly NavLinkItem[] = [
  { type: 'link', id: 'about', label: 'About', href: '/about' },
  { type: 'link', id: 'societies', label: 'Societies', href: '/societies' },
  { type: 'link', id: 'judging', label: 'Judging & Awards', href: '/judging' },
  { type: 'link', id: 'events', label: 'Events', href: '/events' },
  {
    type: 'link',
    id: 'national-show',
    label: 'National Show',
    href: nosUrl('/'),
    crossSite: true,
  },
  { type: 'link', id: 'sponsors', label: 'Sponsors', href: '/sponsors' },
];

/**
 * Contact, rendered by Header and MobileMenu after the NAV items. Deliberately
 * not a NAV entry.
 */
export const CONTACT_LINK: NavLeaf = { id: 'contact-link', label: 'Contact', href: '/contact' };
