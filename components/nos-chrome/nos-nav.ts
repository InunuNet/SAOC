// =============================================================
// NOS — components/nos-chrome/nos-nav.ts
// The National Orchid Show site's menu: the Visit / Programme / Exhibit & trade groups, the
// "The show" links and the Tickets destinations. Labels, descriptors and order are the ones the
// SAOC site's old National Show mega carried (mission menu-system-layout4, Brad's approved Layout 4)
// - moved here verbatim when the show became its own site (mission nos-site-split F3), never
// retyped. Descriptors are trimmed prefixes of the route manifest's own `purpose` field, never
// free text.
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
            descriptor: 'Buy admission tickets.',
          },
          {
            id: 'show-sponsors',
            label: 'Show sponsors',
            href: showPath('/sponsors'),
            descriptor: 'The sponsors behind the National Show.',
          },
          {
            id: 'past-shows',
            label: 'Past shows',
            href: showPath('/archive'),
            descriptor: 'Previous editions.',
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
            descriptor: "The show's theme, what it brings together, and who takes part.",
          },
          {
            id: 'what-to-expect',
            label: 'What to expect',
            href: showPath('/what-to-expect'),
            descriptor: 'Hours, admission and on-the-day detail for visitors.',
          },
          {
            id: 'plan-your-visit',
            label: 'Plan your visit',
            href: showPath('/plan-your-visit'),
            descriptor: 'Travel, parking, accommodation and nearby attractions.',
          },
          {
            id: 'faq',
            label: 'FAQ',
            href: showPath('/faq'),
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
            href: showPath('/programme'),
            descriptor: 'The overall schedule of sessions across the four show days.',
          },
          {
            id: 'workshops',
            label: 'Workshops',
            href: showPath('/workshops'),
            descriptor: 'Book Sunset Cocktails and guided Field Trip outings.',
          },
          {
            id: 'symposium',
            label: 'Symposium',
            href: showPath('/symposium'),
            descriptor: 'The National Orchid Show Symposium — what it is, its theme, and who it is for.',
          },
          {
            id: 'wosa-conference',
            label: 'WOSA Conference',
            href: showPath('/wosa-conference'),
            descriptor:
              'What the WOSA Conference is and who it is for, with a link out to WOSA for wild-orchid content.',
          },
          {
            id: 'conferences',
            label: 'Conference registration',
            href: showPath('/conferences'),
            descriptor: 'Register for the Symposium and WOSA Conference.',
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
            descriptor: 'Public directory of international guests and exhibitors attending the show.',
          },
          {
            id: 'exhibitors',
            label: 'Exhibitor entry guide',
            href: showPath('/exhibitors'),
            descriptor: 'Entry process, fees, classes, judging and eligibility for growers entering plants.',
          },
          {
            id: 'vendors',
            label: 'Exhibitors and vendors',
            href: showPath('/vendors'),
            descriptor: 'Trade vendor showcase, application and registration.',
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
