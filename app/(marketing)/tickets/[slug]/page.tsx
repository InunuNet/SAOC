import { viewerIsVerifiedAdmin } from '@/lib/admin-viewer';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { NosHero } from '@/components/nos/NosHero';
import { SalesClosedNotice, TicketPurchaseForm } from '@/components/tickets';
import type { TicketTypeCardData } from '@/components/tickets';
import { TicketCard } from '@/components/tickets/keepsake';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeShowWindowQuery,
  nationalShowSalesQuery,
  ticketsPageQuery,
  ticketTypeBySlugQuery,
} from '@/sanity/queries';
import { getAdmissionSoldOutBySlug } from '@/lib/data/admission-availability';
import { CART_MAX_LINE_ITEMS } from '@/lib/cart';
import { resolveEffectivePrice } from '@/lib/checkout-reservation';
import { productIdForSlug } from '@/lib/data/ticket-presentation';
import { buildShowWindow, computeShowDays } from '@/lib/show-window-lookup';
import { resolveActiveShow } from '@/lib/show-resolution';

// F2 (ticketing-flow-redesign, M2) — the dedicated single-type buy screen. Same
// force-dynamic reasoning as app/(marketing)/tickets/page.tsx: getSoldCountsByTicketType()
// (Firebase Admin SDK, runtime-only credentials) means this route can never be prerendered.
export const dynamic = 'force-dynamic';

const FALLBACK_SOLD_OUT = 'Sold out';
const FALLBACK_SALES_CLOSED = 'Ticket sales are not yet open — check back soon.';

interface TicketsPageData {
  soldOutMessage?: string | null;
  salesClosedMessage?: string | null;
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

interface SanityTicketType {
  _id: string;
  name: string;
  slug: string;
  price: number;
  regularPrice?: number | null;
  description: string;
  capacity: number;
  releasedQuantity?: number | null;
  earlyBirdCutoff?: string | null;
  provisional?: boolean | null;
  requiresDaySelection?: boolean | null;
  category?: string | null;
  capacityPool?: string | null;
  headcountPerUnit?: number | null;
  excludedDays?: string[] | null;
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ quantity?: string | string[]; day?: string | string[] }>;
}

// A hub card's "Buy ticket" link carries ?quantity (and ?day for a Day Pass). Anything that
// is not a whole number in 1..CART_MAX_LINE_ITEMS falls back to an empty cart.
function parseQuantity(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const quantity = Number.parseInt(raw, 10);
  return quantity >= 1 && quantity <= CART_MAX_LINE_ITEMS ? quantity : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ticketType = await sanityFetch<SanityTicketType | null>({
    query: ticketTypeBySlugQuery,
    params: { slug },
    tags: ['ticketType', 'sanity'],
  });
  return { title: ticketType?.name ?? 'Tickets' };
}

export default async function TicketBuyPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const [ticketType, pageData, salesState, allShows] = await Promise.all([
    sanityFetch<SanityTicketType | null>({
      query: ticketTypeBySlugQuery,
      params: { slug },
      tags: ['ticketType', 'sanity'],
    }),
    sanityFetch<TicketsPageData>({ query: ticketsPageQuery, tags: ['ticketsPage', 'sanity'] }),
    sanityFetch<SalesState>({ query: nationalShowSalesQuery, tags: ['nationalShow', 'sanity'] }),
    sanityFetch<SanityShowActivation[]>({ query: activeShowWindowQuery, tags: ['show', 'sanity'] }),
  ]);

  // Every product, admission or programme, buys through this one screen: the hub's Thursday
  // evening, Symposium, WOSA and Workshops cards all link here.
  if (!ticketType) {
    notFound();
  }

  const activeShowId = resolveActiveShow(allShows ?? []);
  const activeShowDoc = activeShowId ? (allShows ?? []).find((s) => s._id === activeShowId) : null;
  const showWindow = buildShowWindow(activeShowDoc ?? null);
  // A day the product excludes (the Day Pass has no Thursday) is not offered: checkout rejects it.
  const excludedDays = ticketType.excludedDays ?? [];
  const showDays = (showWindow ? computeShowDays(showWindow) : []).filter(
    (day) => !excludedDays.includes(day)
  );

  const salesOpen = salesState?.salesOpen === true;
  const soldOutMessage = pageData?.soldOutMessage ?? FALLBACK_SOLD_OUT;
  const salesClosedMessage = pageData?.salesClosedMessage ?? FALLBACK_SALES_CLOSED;

  const soldOutBySlug = salesOpen
    ? await getAdmissionSoldOutBySlug([ticketType], activeShowId)
    : {};

  const effectivePrice =
    resolveEffectivePrice({
      price: ticketType.price,
      regularPrice: ticketType.regularPrice ?? null,
      earlyBirdCutoff: ticketType.earlyBirdCutoff ?? null,
      now: new Date(),
    }) ?? ticketType.price;

  const cardData: TicketTypeCardData = {
    slug: ticketType.slug,
    name: ticketType.name,
    price: effectivePrice,
    regularPrice: ticketType.regularPrice ?? null,
    description: ticketType.description,
    soldOut: soldOutBySlug[ticketType.slug] === true,
    provisional: ticketType.provisional === true,
    requiresDaySelection: ticketType.requiresDaySelection === true,
  };

  const quantity = parseQuantity(query.quantity);
  const day = typeof query.day === 'string' && showDays.includes(query.day) ? query.day : null;
  const productId = productIdForSlug(ticketType.slug);
  const summaryDay = cardData.requiresDaySelection ? (day ?? showDays[0] ?? null) : null;
  const purchasable = salesOpen && !cardData.soldOut;

  return (
    <>
      <NosHero
        route={`/tickets/${ticketType.slug}`}
        title={ticketType.name}
        lede={ticketType.description}
        className="nk-hero-compact"
      />

      <div className="mx-auto max-w-[560px] px-8 pb-12 pt-4">
        {!salesOpen ? (
          <SalesClosedNotice message={salesClosedMessage} />
        ) : cardData.soldOut ? (
          <div className="nk-closed" role="status">
            <p className="font-serif text-[20px] text-ink">{soldOutMessage}</p>
          </div>
        ) : null}
        {purchasable && productId ? (
          <div className="nk-wrap nk-checkout-summary">
            <TicketCard
              productId={productId}
              variant="summary"
              headingLevel="h2"
              day={summaryDay}
              provisionalPrice={cardData.provisional}
              name={ticketType.name}
              vm={{
                slug: ticketType.slug,
                name: ticketType.name,
                state: 'available',
                price: effectivePrice,
                regularPrice: null,
                scarcity: null,
                days: null,
              }}
            />
          </div>
        ) : null}
        {purchasable ? (
          <TicketPurchaseForm
            ticketTypes={[cardData]}
            showDays={showDays}
            initialQuantity={quantity ?? undefined}
            initialDay={day}
            showTestModeBanner={await viewerIsVerifiedAdmin()}
          />
        ) : null}
      </div>
    </>
  );
}
