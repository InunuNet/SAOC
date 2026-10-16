import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge } from '@/components/nos/Badge';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { SalesClosedNotice } from '@/components/tickets';
import { OzowSandboxTestModeBanner } from '@/components/tickets/OzowSandboxTestModeBanner';
import { cheapestAdmission, formatRand } from '@/components/nos/cheapest-admission';
import { filterPubliclyListableTicketTypes } from '@/lib/demo-ticket-type';
import { sanityFetch } from '@/sanity/lib/fetch';
import { activeTicketTypesByCategoryQuery, nationalShowSalesQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site. This page
// only reads Sanity (no Firebase Admin sold-count call), so — unlike /tickets and the shared
// CategoryTicketsPage — it does not need force-dynamic.
export const revalidate = 60;

// Description restates the page's own rendered lede below. This route is a five-product
// router, so it is never used as an Offer target — those point at /tickets/<slug> (M6/B8b).
export const metadata: Metadata = buildPageMetadata({
  title: 'Tickets — National Show',
  image: nosOgImage('Tickets — National Show'),
  description:
    "Choose the option that matches why you're coming to the 2027 SAOC National Show — " +
    "we'll take you straight to the right form.",
  path: '/national-show/tickets',
});

// F8 (nos-design-system, M3): the visitor-admission option used to be one of five equal
// cards. It is now the dominant front-door block below, carrying a real price; these four
// remain the secondary routes for every other reason someone lands on this page. Copy is
// preserved verbatim from the pre-restyle page — see CLAUDE.md "no invented content".
const SECONDARY_OPTIONS = [
  {
    id: 'exhibitor',
    heading: "I'm exhibiting orchids",
    body: 'See what is involved in exhibiting at the National Show. Entry sales are not yet open — they open closer to the show.',
    cta: 'Exhibitor entry',
    href: '/national-show/exhibitors',
  },
  {
    id: 'vendor',
    heading: "I'm a nursery or trader",
    body: 'Register a trade booth to sell plants and supplies at the show.',
    cta: 'Vendor registration',
    href: '/national-show/vendors/apply',
  },
  {
    id: 'conferences',
    heading: "I'm attending a conference",
    body: 'Register for the SAOC Symposium, the WOSA Conference, or the combined Joint track.',
    cta: 'Conferences tickets',
    href: '/national-show/conferences',
  },
  {
    id: 'workshops',
    heading: 'I want workshops or a field trip',
    body: 'Book Sunset Cocktails or a guided Field Trip outing at the show.',
    cta: 'Workshops & Field Trips tickets',
    href: '/national-show/workshops',
  },
] as const;

interface SanityAdmissionTicketType {
  _id: string;
  name: string;
  slug: string;
  price: number;
  regularPrice?: number | null;
  earlyBirdCutoff?: string | null;
  requiresDaySelection?: boolean | null;
  provisional?: boolean | null;
  demo?: boolean | null;
  order: number;
}

interface NationalShowSalesState {
  salesOpen?: boolean | null;
}

export default async function NationalShowTicketsPage() {
  const [ticketTypes, salesState] = await Promise.all([
    sanityFetch<SanityAdmissionTicketType[]>({
      query: activeTicketTypesByCategoryQuery,
      params: { category: 'admission' },
      tags: ['ticketType', 'sanity'],
    }),
    sanityFetch<NationalShowSalesState>({
      query: nationalShowSalesQuery,
      tags: ['nationalShow', 'sanity'],
    }),
  ]);

  const salesOpen = salesState?.salesOpen === true;
  // `order asc` from the query — the first, lowest-numbered public (non-demo) product is the
  // one the dominant visitor journey ("I'm coming to visit") is anchored on. The same filter
  // /tickets uses drops demo products, so every link below resolves on /tickets/[slug].
  const admissionProducts = filterPubliclyListableTicketTypes(ticketTypes ?? []);
  const dominant = admissionProducts[0] ?? null;

  // The price block names the cheapest admission ("{title} from R{min}"), the same product the
  // hub's hero anchor names; the buttons keep the catalogue order.
  const cheapest = cheapestAdmission(admissionProducts, new Date());

  return (
    <>
      <NosHero
        route="/national-show/tickets"
        title="What are you here for?"
        lede="Choose the option that matches why you're coming to the 2027 SAOC National Show — we'll take you straight to the right form."
        priority
      />

      <NosSection wrapClassName="space-y-10">
        {salesOpen ? <OzowSandboxTestModeBanner /> : null}
        {/* Dominant admission block — the answer to "what does it cost" before any click,
            per Kew's ordering (research item 2). Hard constraints (day selection, early-bird
            cutoff) get their own short bold line under the price, never folded into prose. */}
        <Card className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <div className="flex flex-col gap-4">
            <Badge tone="purple">Visitor admission</Badge>
            <h2 className="font-serif text-ink">I&rsquo;m coming to visit</h2>
            <p className="font-sans text-[16px] leading-relaxed text-muted">
              Buy an admission ticket to browse the show floor, exhibits, and displays.
            </p>
            {admissionProducts.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {admissionProducts.map((p) => (
                  <Button
                    key={p._id}
                    as={Link}
                    href={`/tickets/${p.slug}`}
                    variant={p._id === dominant?._id ? 'primary' : 'ghost'}
                    className="w-fit whitespace-nowrap max-sm:w-full max-sm:!px-2"
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            ) : (
              <Button
                as={Link}
                href="/tickets"
                variant="primary"
                className="w-fit whitespace-nowrap max-sm:w-full max-sm:!px-2"
              >
                Get visitor tickets
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-rule pt-6 md:border-l md:border-t-0 md:border-rule md:pl-8 md:pt-0">
            {salesOpen && cheapest ? (
              <>
                <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                  From
                </span>
                <span
                  data-placeholder={cheapest.type.provisional ? 'true' : undefined}
                  className="font-serif text-[clamp(34px,4.4vw,48px)] font-medium leading-none text-ink"
                >
                  {cheapest.price === 0 ? 'Free' : formatRand(cheapest.price)}
                </span>
                <h3 className="font-sans text-[14px] font-medium text-primary">
                  {cheapest.type.name}
                </h3>
                {cheapest.type.requiresDaySelection ? (
                  <p className="mt-3 font-sans text-[13px] font-medium text-ink">
                    You must choose a day when you book.
                  </p>
                ) : null}
                {cheapest.type.earlyBirdCutoff ? (
                  <p className="font-sans text-[13px] font-medium text-ink">
                    Early-bird pricing ends{' '}
                    {new Date(cheapest.type.earlyBirdCutoff).toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'long',
                    })}
                    .
                  </p>
                ) : null}
                {cheapest.type.provisional ? (
                  <p className="font-sans text-[12px] italic text-muted">
                    Provisional pricing — subject to change.
                  </p>
                ) : null}
              </>
            ) : !salesOpen ? (
              <SalesClosedNotice message="Ticket sales are not yet open — check back soon." />
            ) : null}
          </div>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2">
          {SECONDARY_OPTIONS.map((option) => (
            <Card key={option.id} className="flex flex-col gap-4">
              <h3 className="font-serif text-[20px] font-medium text-ink">{option.heading}</h3>
              <p className="font-sans text-[17px] leading-relaxed text-muted">{option.body}</p>
              <Button
                as={Link}
                href={option.href}
                variant="ghost"
                data-nos-nowrap=""
                className="mt-auto w-fit whitespace-nowrap max-sm:w-full max-sm:!px-2"
              >
                <span>{option.cta}</span>
              </Button>
            </Card>
          ))}
        </div>
      </NosSection>
    </>
  );
}
