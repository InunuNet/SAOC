import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge } from '@/components/nos/Badge';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { NosHero } from '@/components/nos/NosHero';
import { resolveEffectivePrice } from '@/lib/checkout-reservation';
import { sanityFetch } from '@/sanity/lib/fetch';
import { activeTicketTypesByCategoryQuery, nationalShowSalesQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site. This page
// only reads Sanity (no Firebase Admin sold-count call), so — unlike /tickets and the shared
// CategoryTicketsPage — it does not need force-dynamic.
export const revalidate = 60;

// Description restates the page's own rendered lede below. This route is a five-product
// router, so it is never used as an Offer target — those point at /tickets/<slug> (M6/B8b).
export const metadata: Metadata = buildPageMetadata({
  title: 'Tickets — National Show',
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
  // one the dominant visitor journey ("I'm coming to visit") is anchored on.
  const dominant = (ticketTypes ?? []).find((t) => !t.demo) ?? null;

  const dominantPrice = dominant
    ? (resolveEffectivePrice({
        price: dominant.price,
        regularPrice: dominant.regularPrice ?? null,
        earlyBirdCutoff: dominant.earlyBirdCutoff ?? null,
        now: new Date(),
      }) ?? dominant.price)
    : null;

  return (
    <>
      <NosHero
        image="/images/orchid-dark.jpg"
        eyebrow="National Show"
        title="What are you here for?"
        lede="Choose the option that matches why you're coming to the 2027 SAOC National Show — we'll take you straight to the right form."
        priority
      />

      <div className="mx-auto max-w-[1280px] space-y-10 px-8 py-16">
        {/* Dominant admission block — the answer to "what does it cost" before any click,
            per Kew's ordering (research item 2). Hard constraints (day selection, early-bird
            cutoff) get their own short bold line under the price, never folded into prose. */}
        <Card className="grid gap-8 p-8 sm:p-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <div className="flex flex-col gap-4">
            <Badge tone="purple">Visitor admission</Badge>
            <h2 className="font-serif text-[clamp(28px,3.4vw,38px)] font-medium leading-[1.1] text-ink">
              I&rsquo;m coming to visit
            </h2>
            <p className="font-sans text-[16px] leading-relaxed text-muted">
              Buy an admission ticket to browse the show floor, exhibits, and displays.
            </p>
            <Button as={Link} href="/tickets" variant="primary" className="w-fit">
              Get visitor tickets
            </Button>
          </div>

          <div className="flex flex-col gap-2 border-t border-rule pt-6 md:border-l md:border-t-0 md:border-rule md:pl-8 md:pt-0">
            {salesOpen && dominant && dominantPrice !== null ? (
              <>
                <span className="font-sans text-[12px] font-medium uppercase tracking-[0.2em] text-muted">
                  From
                </span>
                <span
                  data-placeholder={dominant.provisional ? 'true' : undefined}
                  className="font-serif text-[clamp(34px,4.4vw,48px)] font-medium leading-none text-ink"
                >
                  {dominantPrice === 0 ? 'Free' : `R${dominantPrice.toFixed(2)}`}
                </span>
                <span className="font-sans text-[13px] text-muted">{dominant.name}</span>
                {dominant.requiresDaySelection ? (
                  <p className="mt-3 font-sans text-[13px] font-medium text-ink">
                    You must choose a day when you book.
                  </p>
                ) : null}
                {dominant.earlyBirdCutoff ? (
                  <p className="font-sans text-[13px] font-medium text-ink">
                    Early-bird pricing ends{' '}
                    {new Date(dominant.earlyBirdCutoff).toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'long',
                    })}
                    .
                  </p>
                ) : null}
                {dominant.provisional ? (
                  <p className="font-sans text-[12px] italic text-muted">
                    Provisional pricing — subject to change.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="font-sans text-[14px] leading-relaxed text-muted">
                Ticket sales are not yet open — check back soon.
              </p>
            )}
          </div>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2">
          {SECONDARY_OPTIONS.map((option) => (
            <Card key={option.id} className="flex flex-col gap-4">
              <h3 className="font-serif text-[20px] font-medium text-ink">{option.heading}</h3>
              <p className="font-sans text-[14px] leading-relaxed text-muted">{option.body}</p>
              <Button as={Link} href={option.href} variant="ghost" className="mt-auto w-fit">
                {option.cta}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
