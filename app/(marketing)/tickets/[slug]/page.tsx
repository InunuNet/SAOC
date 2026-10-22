import { viewerIsVerifiedAdmin } from '@/lib/admin-viewer';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NosHero } from '@/components/nos/NosHero';
import { JsonLd, breadcrumbJsonLd } from '@/components/seo/JsonLd';
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
import {
  getAdmissionSoldOutBySlug,
  loadTicketCardViewModels,
} from '@/lib/data/admission-availability';
import { CART_MAX_LINE_ITEMS } from '@/lib/cart';
import { resolveEffectivePrice } from '@/lib/checkout-reservation';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { productIdForSlug } from '@/lib/data/ticket-presentation';
import { buildShowWindow, computeShowDays } from '@/lib/show-window-lookup';
import { resolveActiveShow } from '@/lib/show-resolution';
import { buildPageMetadata } from '@/lib/seo';

// F2 (ticketing-flow-redesign, M2) — the dedicated single-type buy screen. Same
// force-dynamic reasoning as app/(marketing)/tickets/page.tsx: getSoldCountsByTicketType()
// (Firebase Admin SDK, runtime-only credentials) means this route can never be prerendered.
export const dynamic = 'force-dynamic';

const NOS_TITLE_SUFFIX = ' — National Orchid Show | SAOC';

// r18 (Codi): the checkout step carries the tickets hub's breadcrumb (TicketsMasthead) one level
// deeper, and mirrors the hub's BreadcrumbList (NosBreadcrumbJsonLd) with the product appended.
const SITE_ORIGIN = 'https://saoc.co.za';
const HUB_TRAIL = [
  { name: 'National Show', href: '/national-show' },
  { name: 'Tickets', href: '/national-show/tickets' },
];

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
  if (!ticketType) notFound();
  // A ticket is a NOS page (R62 #1), but /tickets/* sits outside national-show/layout.tsx's
  // title template, so the NOS suffix is spelled out here.
  // Sanity does not require a description: without one the page keeps the site default
  // (fitDescription cannot take a missing string).
  if (!ticketType.description?.trim()) {
    return { title: { absolute: `${ticketType.name}${NOS_TITLE_SUFFIX}` } };
  }
  return {
    ...buildPageMetadata({
      title: ticketType.name,
      description: ticketType.description,
      lede: ticketType.description,
      path: `/tickets/${slug}`,
    }),
    title: { absolute: `${ticketType.name}${NOS_TITLE_SUFFIX}` },
  };
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
  // r45b: with no ?day the summary keeps the product's own stub and when line, never the first show day.
  const summaryDay = cardData.requiresDaySelection ? day : null;
  const purchasable = salesOpen && !cardData.soldOut;
  // rLC (r45 P3): the Day Pass shows the hub card's own per-day counts, from the hub's own
  // loader; no other product has them. A failed load leaves `cards` empty, so no counts show.
  const dayCounts =
    purchasable && cardData.requiresDaySelection && productId === 'day'
      ? ((await loadTicketCardViewModels()).cards.day?.days ?? null)
      : null;
  const showProvisional = !withholdPlaceholderProse();

  const breadcrumbs = (
    <nav className="nk-crumbs" aria-label="Breadcrumb">
      <Link href="/national-show">National Show</Link>
      <span className="nk-crumb">
        <span className="nk-sep" aria-hidden="true" />
        <Link href="/national-show/tickets">Tickets</Link>
      </span>
      <span className="nk-crumb">
        <span className="nk-sep" aria-hidden="true" />
        <span aria-current="page">{ticketType.name}</span>
      </span>
    </nav>
  );

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          ...HUB_TRAIL.map(({ name, href }) => ({ name, url: `${SITE_ORIGIN}${href}` })),
          { name: ticketType.name, url: `${SITE_ORIGIN}/tickets/${encodeURIComponent(slug)}` },
        ])}
      />
      <NosHero
        route={`/tickets/${ticketType.slug}`}
        title={ticketType.name}
        lede={ticketType.description}
        crumbs={breadcrumbs}
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
              headingLevel="p"
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
            dayCounts={dayCounts}
            showProvisional={showProvisional}
            showTestModeBanner={await viewerIsVerifiedAdmin()}
          />
        ) : null}
      </div>
    </>
  );
}
