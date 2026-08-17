import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { SalesClosedNotice, TicketPurchaseForm } from '@/components/tickets';
import type { TicketTypeCardData } from '@/components/tickets';
import { sanityFetch } from '@/sanity/lib/fetch';
import { activeTicketTypesQuery, nationalShowSalesQuery, ticketsPageQuery } from '@/sanity/queries';
import { getSoldCountsByTicketType } from '@/lib/data/tickets';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { filterPubliclyListableTicketTypes } from '@/lib/demo-ticket-type';

// This page calls getSoldCountsByTicketType() (lib/data/tickets.ts), which uses the
// Firebase Admin SDK — and FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY are
// deliberately RUNTIME-only in apphosting.yaml (sold counts are live inventory; baking
// them into a prerendered build risks showing availability that isn't real and overselling
// the show — see contracts/contract-build-without-secrets.yaml). force-dynamic renders this
// page at request time on every hit instead of prerendering it, so the build never needs
// Admin credentials. This intentionally opts /tickets OUT of the F1 cms-loop's 60s ISR bound
// (contracts/cms-loop-f1-cdn-purge.yaml) — that bound still applies to every other
// CMS-backed page (revalidate-60-pages.golden.txt), which deliberately excludes this page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Tickets' };

interface TicketsPageData {
  title?: string | null;
  intro?: string | null;
  buyButtonLabel?: string | null;
  soldOutMessage?: string | null;
  salesClosedMessage?: string | null;
  termsNote?: string | null;
}

interface SanityTicketType {
  _id: string;
  name: string;
  slug: string;
  price: number;
  description: string;
  capacity: number;
  order: number;
  demo?: boolean | null;
}

interface SalesState {
  salesOpen?: boolean | null;
}

// Static fallbacks — the seed script always populates these, but a page render
// should never break if Sanity is briefly unreachable.
const FALLBACK_TITLE = 'Get Your Tickets';
const FALLBACK_INTRO = "Secure your seat at the SAOC National Show.";
const FALLBACK_BUY_LABEL = 'Buy Ticket';
const FALLBACK_SOLD_OUT = 'Sold out';
const FALLBACK_SALES_CLOSED = 'Ticket sales are not yet open — check back soon.';

export default async function TicketsPage() {
  const [pageData, salesState, ticketTypes] = await Promise.all([
    sanityFetch<TicketsPageData>({ query: ticketsPageQuery, tags: ['ticketsPage', 'sanity'] }),
    sanityFetch<SalesState>({ query: nationalShowSalesQuery, tags: ['nationalShow', 'sanity'] }),
    sanityFetch<SanityTicketType[]>({
      query: activeTicketTypesQuery,
      tags: ['ticketType', 'sanity'],
    }),
  ]);

  const salesOpen = salesState?.salesOpen === true;
  const title = pageData?.title ?? FALLBACK_TITLE;
  const intro = pageData?.intro ?? FALLBACK_INTRO;
  const buyButtonLabel = pageData?.buyButtonLabel ?? FALLBACK_BUY_LABEL;
  const soldOutMessage = pageData?.soldOutMessage ?? FALLBACK_SOLD_OUT;
  const salesClosedMessage = pageData?.salesClosedMessage ?? FALLBACK_SALES_CLOSED;
  const termsNote = pageData?.termsNote ?? '';

  // F9 (ticketing-foundation): the demo ticket type must never present to a visitor as real
  // pricing — see contracts/golden/ticketing-f9-demo-ticket/README.md, "A real, pre-existing
  // gap this contract closes". ticketTypeBySlugQuery (checkout's own lookup) is deliberately
  // left unfiltered so a direct, known-slug purchase of the demo type still succeeds.
  const types = filterPubliclyListableTicketTypes(ticketTypes ?? []);
  const soldCounts = salesOpen ? await getSoldCountsByTicketType(NATIONAL_SHOW_ID) : {};

  const cardData: TicketTypeCardData[] = types.map((t) => ({
    slug: t.slug,
    name: t.name,
    price: t.price,
    description: t.description,
    soldOut: (soldCounts[t.slug] ?? 0) >= t.capacity,
  }));
  const allSoldOut = cardData.length > 0 && cardData.every((t) => t.soldOut);

  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="2027 National Show"
        heading={title}
        lede={intro}
      />

      <div className="mx-auto max-w-[720px] px-8 py-16 space-y-10">
        {!salesOpen ? (
          <SalesClosedNotice message={salesClosedMessage} />
        ) : allSoldOut ? (
          <div className="border border-rule bg-bone px-6 py-8 text-center" role="status">
            <p className="font-serif text-[20px] text-ink">{soldOutMessage}</p>
          </div>
        ) : (
          <TicketPurchaseForm
            ticketTypes={cardData}
            buyButtonLabel={buyButtonLabel}
            soldOutMessage={soldOutMessage}
          />
        )}

        {termsNote ? (
          <p className="border-t border-rule pt-6 font-sans text-[13px] leading-relaxed text-muted">
            {termsNote}
          </p>
        ) : null}
      </div>
    </>
  );
}
