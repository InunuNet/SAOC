import { notFound } from 'next/navigation';

import { PageHero } from '@/components/ui/PageHero';
import { SalesClosedNotice, TicketPurchaseForm } from '@/components/tickets';
import type { TicketTypeCardData } from '@/components/tickets';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeShowWindowQuery,
  nationalShowSalesQuery,
  ticketsPageQuery,
  ticketTypeBySlugQuery,
  ticketTypesByPoolQuery,
} from '@/sanity/queries';
import { getSoldCountsByTicketType } from '@/lib/data/tickets';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import {
  effectiveCapacity,
  planPooledCapacity,
  resolveEffectivePrice,
  type CapacityPoolConfig,
} from '@/lib/checkout-reservation';
import { buildShowWindow, computeShowDays } from '@/lib/show-window-lookup';
import { resolveActiveShow } from '@/lib/show-resolution';

// F2 (ticketing-flow-redesign, M2) — the dedicated single-type buy screen. Same
// force-dynamic reasoning as app/(marketing)/tickets/page.tsx: getSoldCountsByTicketType()
// (Firebase Admin SDK, runtime-only credentials) means this route can never be prerendered.
export const dynamic = 'force-dynamic';

const FALLBACK_BUY_LABEL = 'Buy Ticket';
const FALLBACK_SOLD_OUT = 'Sold out';
const FALLBACK_SALES_CLOSED = 'Ticket sales are not yet open — check back soon.';

interface TicketsPageData {
  buyButtonLabel?: string | null;
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
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TicketBuyPage({ params }: Props) {
  const { slug } = await params;

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

  // Null category defaults to admission, matching activeTicketTypesByCategoryQuery's own
  // read-time fallback (sanity/queries.ts) — see lib/tickets-category-warning.ts. A real,
  // non-admission category (Conferences/Workshops products) is NOT reachable via this route.
  const category = ticketType?.category ?? 'admission';
  if (!ticketType || category !== 'admission') {
    notFound();
  }

  const activeShowId = resolveActiveShow(allShows ?? []);
  const activeShowDoc = activeShowId ? (allShows ?? []).find((s) => s._id === activeShowId) : null;
  const showWindow = buildShowWindow(activeShowDoc ?? null);
  const showDays = showWindow ? computeShowDays(showWindow) : [];

  const salesOpen = salesState?.salesOpen === true;
  const buyButtonLabel = pageData?.buyButtonLabel ?? FALLBACK_BUY_LABEL;
  const soldOutMessage = pageData?.soldOutMessage ?? FALLBACK_SOLD_OUT;
  const salesClosedMessage = pageData?.salesClosedMessage ?? FALLBACK_SALES_CLOSED;

  const soldCounts = salesOpen ? await getSoldCountsByTicketType(NATIONAL_SHOW_ID) : {};

  const poolKey = ticketType.capacityPool ?? ticketType.slug;
  const poolConfigByType: Record<string, CapacityPoolConfig> = {
    [ticketType.slug]: {
      pool: ticketType.capacityPool ?? null,
      headcountPerUnit: ticketType.headcountPerUnit ?? 1,
    },
  };
  const capacityByType: Record<string, number> = {
    [poolKey]: effectiveCapacity(ticketType.capacity, ticketType.releasedQuantity),
  };

  if (ticketType.capacityPool) {
    const siblingDocs =
      (await sanityFetch<{ slug: string | null; headcountPerUnit?: number | null }[]>({
        query: ticketTypesByPoolQuery,
        params: { pool: ticketType.capacityPool, showId: activeShowId },
        tags: ['ticketType', 'sanity'],
      })) ?? [];
    for (const sibling of siblingDocs) {
      if (!sibling.slug || sibling.slug in poolConfigByType) continue;
      poolConfigByType[sibling.slug] = {
        pool: ticketType.capacityPool,
        headcountPerUnit: sibling.headcountPerUnit ?? 1,
      };
    }
  }

  const poolCheck = planPooledCapacity({
    requestedQtyByType: { [ticketType.slug]: 1 },
    soldCountsByType: soldCounts,
    capacityByType,
    poolConfigByType,
  });

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
    soldOut: poolCheck.kind === 'over-capacity',
    provisional: ticketType.provisional === true,
    requiresDaySelection: ticketType.requiresDaySelection === true,
  };

  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="2027 National Show"
        heading={ticketType.name}
        lede={ticketType.description}
      />

      <div className="mx-auto max-w-[560px] px-8 py-16">
        {!salesOpen ? (
          <SalesClosedNotice message={salesClosedMessage} />
        ) : cardData.soldOut ? (
          <div className="border border-rule bg-bone px-6 py-8 text-center" role="status">
            <p className="font-serif text-[20px] text-ink">{soldOutMessage}</p>
          </div>
        ) : (
          <TicketPurchaseForm
            ticketTypes={[cardData]}
            buyButtonLabel={buyButtonLabel}
            soldOutMessage={soldOutMessage}
            showDays={showDays}
          />
        )}
      </div>
    </>
  );
}
