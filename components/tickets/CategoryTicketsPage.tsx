import type { ReactNode } from 'react';

import { PageHero } from '@/components/ui/PageHero';
import { SalesClosedNotice, TicketPurchaseForm } from '@/components/tickets';
import type { TicketTypeCardData } from '@/components/tickets';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeShowWindowQuery,
  activeTicketTypesByCategoryQuery,
  nationalShowSalesQuery,
  ticketsPageQuery,
} from '@/sanity/queries';
import { getSoldCountsByTicketType } from '@/lib/data/tickets';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { warnMissingCategoryFallback } from '@/lib/tickets-category-warning';
import { filterPubliclyListableTicketTypes } from '@/lib/demo-ticket-type';
import { effectiveCapacity } from '@/lib/checkout-reservation';
import { buildShowWindow, computeShowDays } from '@/lib/show-window-lookup';
import { resolveActiveShow } from '@/lib/show-resolution';
import type { ProvisionalProductCategory } from '@/lib/provisional-figures';

// F3 (ticketing-conferences-and-events, M2) — extracted from /tickets/page.tsx's original
// body so /tickets, /national-show/conferences, and /national-show/workshops share one real
// implementation instead of ~130 lines triplicated. Every route file using this component
// must itself set `export const dynamic = 'force-dynamic'` — this page calls
// getSoldCountsByTicketType() (Firebase Admin SDK, runtime-only credentials), so live
// inventory can never be baked into a prerendered build. See
// contracts/golden/ticketing-purchase-pages-f3/README.md.

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
  releasedQuantity?: number | null;
  order: number;
  demo?: boolean | null;
  provisional?: boolean | null;
  requiresDaySelection?: boolean | null;
  category?: string | null;
}

interface SalesState {
  salesOpen?: boolean | null;
}

interface SanityShowActivation {
  _id: string;
  active: boolean | null;
  startDate?: unknown;
  endDate?: unknown;
}

const FALLBACK_BUY_LABEL = 'Buy Ticket';
const FALLBACK_SOLD_OUT = 'Sold out';
const FALLBACK_SALES_CLOSED = 'Ticket sales are not yet open — check back soon.';

export interface CategoryTicketsPageProps {
  category: ProvisionalProductCategory;
  heroImage: string;
  eyebrow: string;
  /**
   * Admission (`/tickets`) uses this as the FALLBACK for the `ticketsPage` singleton's
   * `title` field, matching the page's pre-existing behavior byte-for-byte. Conference and
   * workshop-field-trip pages have no singleton of their own — this value is used as their
   * heading outright, never overridden by the shared `ticketsPage` singleton's title (which
   * belongs to /tickets and would show "Get Your Tickets" wrongly). See decision record
   * "Reuse the existing ticketsPage Sanity singleton for generic microcopy only".
   */
  heading: string;
  /** Same fallback-vs-outright rule as `heading`, against the singleton's `intro` field. */
  lede: string;
  /** Optional extra copy rendered above the ticket list — e.g. the workshops page's honesty
   *  note that individual workshop sessions are not yet available for purchase. */
  note?: ReactNode;
}

export async function CategoryTicketsPage({
  category,
  heroImage,
  eyebrow,
  heading,
  lede,
  note,
}: CategoryTicketsPageProps) {
  const [pageData, salesState, ticketTypes, allShows] = await Promise.all([
    sanityFetch<TicketsPageData>({ query: ticketsPageQuery, tags: ['ticketsPage', 'sanity'] }),
    sanityFetch<SalesState>({ query: nationalShowSalesQuery, tags: ['nationalShow', 'sanity'] }),
    sanityFetch<SanityTicketType[]>({
      query: activeTicketTypesByCategoryQuery,
      params: { category },
      tags: ['ticketType', 'sanity'],
    }),
    sanityFetch<SanityShowActivation[]>({
      query: activeShowWindowQuery,
      tags: ['show', 'sanity'],
    }),
  ]);

  warnMissingCategoryFallback(ticketTypes ?? [], category);

  // F5 (ticketing-f5-day-attendees): the SAME resolveActiveShow()/buildShowWindow()/
  // computeShowDays() the checkout route calls — one computation, two call sites — so the
  // days shown here and the days the server accepts can never independently drift.
  const activeShowId = resolveActiveShow(allShows ?? []);
  const activeShowDoc = activeShowId ? (allShows ?? []).find((s) => s._id === activeShowId) : null;
  const showWindow = buildShowWindow(activeShowDoc ?? null);
  const showDays = showWindow ? computeShowDays(showWindow) : [];

  const salesOpen = salesState?.salesOpen === true;
  const title = category === 'admission' ? (pageData?.title ?? heading) : heading;
  const intro = category === 'admission' ? (pageData?.intro ?? lede) : lede;
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
    soldOut: (soldCounts[t.slug] ?? 0) >= effectiveCapacity(t.capacity, t.releasedQuantity),
    provisional: t.provisional === true,
    requiresDaySelection: t.requiresDaySelection === true,
  }));
  const allSoldOut = cardData.length > 0 && cardData.every((t) => t.soldOut);

  return (
    <>
      <PageHero image={heroImage} eyebrow={eyebrow} heading={title} lede={intro} />

      <div className="mx-auto max-w-[720px] px-8 py-16 space-y-10">
        {note}

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
            showDays={showDays}
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
