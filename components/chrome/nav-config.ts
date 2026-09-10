// =============================================================
// SAOC — components/chrome/nav-config.ts
// Site-wide primary nav structure. Header.tsx and MobileMenu.tsx both
// consume this — neither hardcodes nav items or ticket destination hrefs.
//
// Restructured (mission menu-system-layout4 M1/F1, Brad's approved Layout 4,
// artifact b9eadbd4-e165-4de9-884d-86acc9fbf2a2) into a single National Show
// mega carrying all 17 `listed: true` routes from
// content/national-show-routes.json (origin/nos-site): a lead block (eyebrow,
// serif lead linking the hub, and "The Show" group folded underneath), three
// group columns (Visit / Programme / Exhibit & Trade), and a Tickets feature
// rail. Seven top-level items plus Contact (Header.tsx's own action link,
// unchanged). This is the fix for the specific defect Brad reported live: no
// nav item pointed at /national-show at all.
//
// Tickets is deliberately OUT of the top row — see mission section 2,
// "Still unruled". This is a reversible one-line decision, not a closed
// question; do not silently re-add it.
//
// `lead.meta` and `featureRail.meta` carry NO literal copy here — they are a
// shape only. Both are rendered from the nationalShow Sanity singleton at
// render time via lib/show-identity.ts's formatShowDateRange, alongside the
// singleton's own venue.name, exactly the pattern that module exists to
// enforce (its own header comment: seven inlined copies of the same Intl
// call once had the site advertising two different venues in one viewport).
// `featureRail.blurb` has no source anywhere (mission, handoff, or manifest)
// and is omitted entirely, per docs/rules/no-invention.md — never filled
// with a "reasonable-sounding default". See
// .agent/memory/project/specs/menu-system-layout4/goldens/f1-gaps.json.
//
// Descriptor strings on every leaf below are trimmed prefixes of their own
// manifest row's `purpose` field (content/national-show-routes.json,
// origin/nos-site) — never free text. Mechanically checked by
// contracts/checks/menu-system-layout4-f1/check-descriptor-provenance.mjs.
//
// SUPERSEDED (2026-09-10, mission menu-system-layout4 M1/F1): the prior
// structure — Visit/Programme/Exhibit promoted to three separate top-level
// megas, Tickets and Past Editions standalone — is gone. For the still-open
// NOS-lane route-gap list, see
// .agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-pending-nos-routes.json.
//
// SUPERSEDED (2026-09-09, mission site-content-alignment M2/F2): the section
// reconciliation this file used to describe now covers all 20 of Lee-Ann's
// sections, SAOC and National Show alike — see
// .agent/memory/project/specs/site-content-alignment/goldens/fixtures/f1-coverage-map.json,
// the authoritative section-to-route source of truth (not just this file's
// comment).
// =============================================================

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
 * The mega's lead block: eyebrow, serif lead linking the hub, a venue/dates
 * meta line, and the folded-in "The Show" group (Tickets / Show Sponsors /
 * Past Shows) — see mission section 1's track table.
 */
export interface NavMegaLead {
  eyebrow: string;
  leadLabel: string;
  leadHref: string;
  /**
   * Venue + dates line. NOT authored here — rendered at F2/F3 render time
   * from the nationalShow Sanity singleton via lib/show-identity.ts. Left
   * unset in nav-config.ts's static data; the component fills it in.
   */
  meta?: string;
  theShow: NavColumn;
}

/** Bone panel: mono date meta, serif heading, optional blurb, primary CTA. */
export interface NavMegaFeatureRail {
  /** Same render-time-only contract as NavMegaLead.meta. */
  meta?: string;
  heading: string;
  /** No source anywhere for this copy today — omitted, never invented. */
  blurb?: string;
  ctaLabel: string;
  ctaHref: string;
}

export type NavItem =
  | { type: 'link'; id: string; label: string; href: string; disabled?: boolean; quiet?: boolean }
  | {
      type: 'mega';
      id: string;
      label: string;
      href: string;
      ctaLabel?: string;
      lead?: NavMegaLead;
      columns: NavColumn[];
      featureRail?: NavMegaFeatureRail;
    };

export const NAV: readonly NavItem[] = [
  { type: 'link', id: 'about', label: 'About', href: '/about' },
  { type: 'link', id: 'societies', label: 'Societies', href: '/societies' },
  { type: 'link', id: 'judging', label: 'Judging & Awards', href: '/judging' },
  { type: 'link', id: 'events', label: 'Events', href: '/events' },
  { type: 'link', id: 'members', label: 'Members', href: '/members' },
  {
    type: 'mega',
    id: 'national-show',
    label: 'National Show',
    href: '/national-show',
    lead: {
      eyebrow: 'The National Show',
      leadLabel: '19th SAOC National Orchid Show',
      leadHref: '/national-show',
      theShow: {
        id: 'the-show',
        heading: 'The Show',
        headingHref: null,
        links: [
          {
            id: 'tickets',
            label: 'Tickets',
            href: '/national-show/tickets',
            descriptor: 'Buy admission tickets.',
          },
          {
            id: 'show-sponsors',
            label: 'Show Sponsors',
            href: '/national-show/sponsors',
            descriptor: "The Show's own sponsors — a separate list from SAOC's site-level sponsors.",
          },
          {
            id: 'past-shows',
            label: 'Past Shows',
            href: '/national-show/archive',
            descriptor: 'Previous editions and their champions.',
          },
        ],
      },
    },
    columns: [
      {
        id: 'visit',
        heading: 'Visit',
        headingHref: null,
        links: [
          {
            id: 'about-the-show',
            label: 'About the Show',
            href: '/national-show/about',
            descriptor: "The show's theme, what it brings together, and who takes part.",
          },
          {
            id: 'what-to-expect',
            label: 'What to Expect',
            href: '/national-show/what-to-expect',
            descriptor: 'Hours, admission and on-the-day detail for visitors.',
          },
          {
            id: 'plan-your-visit',
            label: 'Plan Your Visit',
            href: '/national-show/plan-your-visit',
            descriptor: 'Travel, parking, accommodation and nearby attractions.',
          },
          {
            id: 'faq',
            label: 'FAQ',
            href: '/national-show/faq',
            descriptor: 'The questions visitors ask us most.',
          },
        ],
      },
      {
        id: 'programme',
        heading: 'Programme',
        headingHref: null,
        links: [
          {
            id: 'programme',
            label: 'Programme',
            href: '/national-show/programme',
            descriptor: 'The overall schedule of sessions across the four show days.',
          },
          {
            id: 'workshops',
            label: 'Workshops',
            href: '/national-show/workshops',
            descriptor: 'Book Sunset Cocktails and guided Field Trip outings.',
          },
          {
            id: 'symposium',
            label: 'SAOC Symposium',
            href: '/national-show/symposium',
            descriptor: 'The SAOC Symposium — what it is, its theme, and who it is for.',
          },
          {
            id: 'wosa-conference',
            label: 'WOSA Conference',
            href: '/national-show/wosa-conference',
            descriptor:
              'What the WOSA Conference is and who it is for, with a link out to WOSA for wild-orchid content.',
          },
          {
            id: 'conferences',
            label: 'Conference Registration',
            href: '/national-show/conferences',
            descriptor: 'Register for the Symposium and WOSA Conference.',
          },
        ],
      },
      {
        id: 'exhibit-trade',
        heading: 'Exhibit & Trade',
        headingHref: null,
        links: [
          {
            id: 'sa-exhibitors',
            label: 'South African Exhibitors',
            href: '/national-show/sa-exhibitors',
            descriptor: 'Public directory of South African nurseries exhibiting at the show.',
          },
          {
            id: 'international-guests',
            label: 'International Guests',
            href: '/national-show/international-guests',
            descriptor: 'Public directory of international guests and exhibitors attending the show.',
          },
          {
            id: 'exhibitors',
            label: 'Exhibitor Entry Guide',
            href: '/national-show/exhibitors',
            descriptor: 'Entry process, fees, classes, judging and eligibility for growers entering plants.',
          },
          {
            id: 'vendors',
            label: 'Trade Vendors',
            href: '/national-show/vendors',
            descriptor: 'Trade vendor showcase, application and gated registration.',
          },
        ],
      },
    ],
    featureRail: {
      heading: 'Tickets',
      ctaLabel: 'Buy tickets',
      ctaHref: '/national-show/tickets',
    },
  },
  { type: 'link', id: 'sponsors', label: 'Sponsors', href: '/sponsors' },
];
