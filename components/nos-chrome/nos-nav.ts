// =============================================================
// NOS — components/nos-chrome/nos-nav.ts
// The National Orchid Show site's menu: the Visit / Programme / Exhibit & trade groups, the
// "The show" links and the Tickets destinations. Labels and order are the ones the
// SAOC site's old National Show mega carried (mission menu-system-layout4, Brad's approved Layout 4)
// - moved here verbatim when the show became its own site (mission nos-site-split F3), never
// retyped. The menu carries no descriptors (NOS Design ND-1).
//
// Hrefs are the INTERNAL show paths (the show tree's own route strings, which page code, the
// route manifest and the sub-nav match against). The NOS chrome shows the public clean path:
// render every href through nosPath() (lib/nos-paths.ts).
//
// `lead.meta` and `featureRail.meta` carry no literal copy: they are a shape only, rendered from
// the nationalShow Sanity singleton at render time (lib/show-identity.ts).
// =============================================================

import type { NavItem } from '@/components/chrome/nav-config';
import { NOS_INTERNAL_PREFIX } from '@/lib/nos-paths';

const NOS_HUB = NOS_INTERNAL_PREFIX;

// The internal href of a show page: the show tree's prefix plus its own path.
function showPath(path: string): string {
  return `${NOS_INTERNAL_PREFIX}${path}`;
}

export const NOS_NAV: readonly NavItem[] = [
  {
    type: 'mega',
    id: 'national-show',
    label: 'National Show',
    href: NOS_HUB,
    lead: {
      eyebrow: 'The National Show',
      leadLabel: '19th National Orchid Show',
      leadHref: NOS_HUB,
      theShow: {
        id: 'the-show',
        heading: 'The show',
        headingHref: null,
        links: [
          {
            id: 'tickets',
            label: 'Tickets',
            href: showPath('/tickets'),
          },
          {
            id: 'show-sponsors',
            label: 'Show sponsors',
            href: showPath('/sponsors'),
          },
          {
            id: 'past-shows',
            label: 'Past shows',
            href: showPath('/archive'),
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
            label: 'About the show',
            href: showPath('/about'),
          },
          {
            id: 'what-to-expect',
            label: 'What to expect',
            href: showPath('/what-to-expect'),
          },
          {
            id: 'plan-your-visit',
            label: 'Plan your visit',
            href: showPath('/plan-your-visit'),
          },
          {
            id: 'faq',
            label: 'FAQ',
            href: showPath('/faq'),
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
            href: showPath('/programme'),
          },
          {
            id: 'workshops',
            label: 'Workshops',
            href: showPath('/workshops'),
          },
          {
            id: 'symposium',
            label: 'Symposium',
            href: showPath('/symposium'),
          },
          {
            id: 'wosa-conference',
            label: 'WOSA Conference',
            href: showPath('/wosa-conference'),
          },
          {
            id: 'conferences',
            label: 'Conference registration',
            href: showPath('/conferences'),
          },
        ],
      },
      {
        id: 'exhibit-trade',
        heading: 'Exhibit & trade',
        headingHref: null,
        links: [
          {
            id: 'international-guests',
            label: 'International guests',
            href: showPath('/international-guests'),
          },
          {
            id: 'exhibitors',
            label: 'Award Entries',
            href: showPath('/award-entries'),
          },
          {
            id: 'vendors',
            label: 'Exhibitors and vendors',
            href: showPath('/vendors'),
          },
        ],
      },
    ],
    featureRail: {
      heading: 'Tickets',
      destinations: [
        { id: 'tickets', label: 'Tickets', href: showPath('/tickets'), variant: 'primary' },
        {
          id: 'day-visitor',
          label: 'Day Visitor',
          href: showPath('/tickets#ticket-day'),
          variant: 'secondary',
        },
        {
          id: 'weekend-pass',
          label: 'Weekend Pass',
          href: showPath('/tickets#ticket-weekend'),
          variant: 'secondary',
        },
      ],
    },
  },
];
