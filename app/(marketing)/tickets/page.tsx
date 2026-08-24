import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { SalesClosedNotice, AdmissionTicketsList } from '@/components/tickets';
import type { TicketTypeCardData } from '@/components/tickets';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeShowWindowQuery,
  activeTicketTypesByCategoryQuery,
  nationalShowSalesQuery,
  ticketsPageQuery,
  ticketTypesByPoolQuery,
} from '@/sanity/queries';
import { getSoldCountsByTicketType } from '@/lib/data/tickets';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { warnMissingCategoryFallback } from '@/lib/tickets-category-warning';
import { filterPubliclyListableTicketTypes } from '@/lib/demo-ticket-type';
import {
  effectiveCapacity,
  planPooledCapacity,
  resolveEffectivePrice,
  type CapacityPoolConfig,
} from '@/lib/checkout-reservation';
import { resolveActiveShow } from '@/lib/show-resolution';

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

const FALLBACK_TITLE = 'Get Your Tickets';
const FALLBACK_INTRO = "Secure your seat at the SAOC National Show.";
const FALLBACK_SOLD_OUT = 'Sold out';
const FALLBACK_SALES_CLOSED = 'Ticket sales are not yet open — check back soon.';

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
  regularPrice?: number | null;
  description: string;
  capacity: number;
  releasedQuantity?: number | null;
  earlyBirdCutoff?: string | null;
  order: number;
  demo?: boolean | null;
  provisional?: boolean | null;
  requiresDaySelection?: boolean | null;
  category?: string | null;
  capacityPool?: string | null;
  headcountPerUnit?: number | null;
}

interface SalesState {
  salesOpen?: boolean | null;
}

interface SanityShowActivation {
  _id: string;
  active: boolean | null;
}

// F2 (ticketing-flow-redesign, M2) — this page's Admission-only render replaces the shared
// multi-select-cart flow (still used, unchanged, by Conferences/Workshops — see
// contracts/golden/ticketing-flow-redesign-f2/README.md §1-2). The data fetch and
// pooled-capacity math below deliberately mirror the sibling component that still powers
// those two other category pages (not reused via import, since this page must stop
// rendering that component's multi-select cart entirely), hardcoded to category: 'admission'.
export default async function TicketsPage() {
  const [pageData, salesState, ticketTypes, allShows] = await Promise.all([
    sanityFetch<TicketsPageData>({ query: ticketsPageQuery, tags: ['ticketsPage', 'sanity'] }),
    sanityFetch<SalesState>({ query: nationalShowSalesQuery, tags: ['nationalShow', 'sanity'] }),
    sanityFetch<SanityTicketType[]>({
      query: activeTicketTypesByCategoryQuery,
      params: { category: 'admission' },
      tags: ['ticketType', 'sanity'],
    }),
    sanityFetch<SanityShowActivation[]>({
      query: activeShowWindowQuery,
      tags: ['show', 'sanity'],
    }),
  ]);

  warnMissingCategoryFallback(ticketTypes ?? [], 'admission');

  const activeShowId = resolveActiveShow(allShows ?? []);

  const salesOpen = salesState?.salesOpen === true;
  const title = pageData?.title ?? FALLBACK_TITLE;
  const intro = pageData?.intro ?? FALLBACK_INTRO;
  const soldOutMessage = pageData?.soldOutMessage ?? FALLBACK_SOLD_OUT;
  const salesClosedMessage = pageData?.salesClosedMessage ?? FALLBACK_SALES_CLOSED;
  const termsNote = pageData?.termsNote ?? '';

  const types = filterPubliclyListableTicketTypes(ticketTypes ?? []);
  const soldCounts = salesOpen ? await getSoldCountsByTicketType(NATIONAL_SHOW_ID) : {};

  const poolConfigByType: Record<string, CapacityPoolConfig> = {};
  const capacityByType: Record<string, number> = {};
  for (const t of types) {
    const poolKey = t.capacityPool ?? t.slug;
    poolConfigByType[t.slug] = { pool: t.capacityPool ?? null, headcountPerUnit: t.headcountPerUnit ?? 1 };
    const ceiling = effectiveCapacity(t.capacity, t.releasedQuantity);
    capacityByType[poolKey] =
      poolKey in capacityByType ? Math.min(capacityByType[poolKey], ceiling) : ceiling;
  }

  const poolKeysTouched = new Set(
    types.map((t) => t.capacityPool).filter((pool): pool is string => Boolean(pool))
  );
  for (const poolKey of poolKeysTouched) {
    const siblingDocs =
      (await sanityFetch<{ slug: string | null; headcountPerUnit?: number | null }[]>({
        query: ticketTypesByPoolQuery,
        params: { pool: poolKey, showId: activeShowId },
        tags: ['ticketType', 'sanity'],
      })) ?? [];
    for (const sibling of siblingDocs) {
      if (!sibling.slug || sibling.slug in poolConfigByType) continue;
      poolConfigByType[sibling.slug] = { pool: poolKey, headcountPerUnit: sibling.headcountPerUnit ?? 1 };
    }
  }

  const cardData: TicketTypeCardData[] = types.map((t) => {
    const poolCheck = planPooledCapacity({
      requestedQtyByType: { [t.slug]: 1 },
      soldCountsByType: soldCounts,
      capacityByType,
      poolConfigByType,
    });
    const effectivePrice =
      resolveEffectivePrice({
        price: t.price,
        regularPrice: t.regularPrice ?? null,
        earlyBirdCutoff: t.earlyBirdCutoff ?? null,
        now: new Date(),
      }) ?? t.price;
    return {
      slug: t.slug,
      name: t.name,
      price: effectivePrice,
      regularPrice: t.regularPrice ?? null,
      description: t.description,
      soldOut: poolCheck.kind === 'over-capacity',
      provisional: t.provisional === true,
      requiresDaySelection: t.requiresDaySelection === true,
    };
  });
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
          <AdmissionTicketsList ticketTypes={cardData} soldOutLabel={soldOutMessage} />
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
