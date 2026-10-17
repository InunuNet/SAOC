// F17 (launch-weekend, scope E): the sold-out verdict for each admission SKU, the same
// pooled-capacity check /tickets runs (planPooledCapacity over getSoldCountsByTicketType),
// extracted so the tickets hub can show a sold-out SKU on its own action while its sibling
// stays live. Server-only: it reaches Firestore through the Admin SDK.
//
// This is a DISPLAY HINT. Checkout re-checks capacity authoritatively, so a failure here is
// logged by error name only and yields no sold-out flags rather than blocking the page.
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeShowWindowQuery,
  activeTicketTypesByCategoryQuery,
  ticketTypesByPoolQuery,
} from '@/sanity/queries';
import {
  effectiveCapacity,
  planPooledCapacity,
  type CapacityPoolConfig,
} from '@/lib/checkout-reservation';
import { REGULAR_PRICE_SIBLING_SLUG } from '@/lib/admission-siblings';
import {
  buildTicketCardViewModels,
  type TicketCardsOutput,
  type TicketTypeInput,
} from '@/lib/data/ticket-card-view-models';
import { WORKSHOPS_PRODUCT_SLUG } from '@/lib/data/ticket-presentation';
import {
  getSoldCountsByTicketType,
  getSoldCountsByTicketTypeAndDay,
} from '@/lib/data/tickets';
import { filterPubliclyListableTicketTypes } from '@/lib/demo-ticket-type';
import {
  DAY_VISITOR_SELLABLE_DAYS,
  DAY_VISITOR_SHAPED_SLUGS,
  WORKSHOP_SESSION_PRICE,
} from '@/lib/provisional-figures';
import { resolveActiveShow } from '@/lib/show-resolution';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

export interface AdmissionAvailabilitySource {
  slug: string;
  capacity: number;
  releasedQuantity?: number | null;
  capacityPool?: string | null;
  headcountPerUnit?: number | null;
}

interface PoolSibling {
  slug: string | null;
  headcountPerUnit?: number | null;
}

export async function getAdmissionSoldOutBySlug(
  types: AdmissionAvailabilitySource[],
  activeShowId: string | null,
): Promise<Record<string, boolean>> {
  try {
    const soldCounts = await getSoldCountsByTicketType(NATIONAL_SHOW_ID);
    const poolConfigByType: Record<string, CapacityPoolConfig> = {};
    const capacityByType: Record<string, number> = {};
    for (const t of types) {
      const poolKey = t.capacityPool ?? t.slug;
      poolConfigByType[t.slug] = {
        pool: t.capacityPool ?? null,
        headcountPerUnit: t.headcountPerUnit ?? 1,
      };
      const ceiling = effectiveCapacity(t.capacity, t.releasedQuantity);
      capacityByType[poolKey] =
        poolKey in capacityByType ? Math.min(capacityByType[poolKey], ceiling) : ceiling;
    }

    const poolKeys = new Set(
      types.map((t) => t.capacityPool).filter((pool): pool is string => Boolean(pool)),
    );
    for (const poolKey of poolKeys) {
      const siblings =
        (await sanityFetch<PoolSibling[]>({
          query: ticketTypesByPoolQuery,
          params: { pool: poolKey, showId: activeShowId },
          tags: ['ticketType', 'sanity'],
        })) ?? [];
      for (const sibling of siblings) {
        if (!sibling.slug || sibling.slug in poolConfigByType) continue;
        poolConfigByType[sibling.slug] = {
          pool: poolKey,
          headcountPerUnit: sibling.headcountPerUnit ?? 1,
        };
      }
    }

    const soldOutBySlug: Record<string, boolean> = {};
    for (const t of types) {
      const check = planPooledCapacity({
        requestedQtyByType: { [t.slug]: 1 },
        soldCountsByType: soldCounts,
        capacityByType,
        poolConfigByType,
      });
      soldOutBySlug[t.slug] = check.kind === 'over-capacity';
    }
    return soldOutBySlug;
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[lib/data/admission-availability] sold-out read failed (${name})`);
    return {};
  }
}

const TICKET_CATEGORIES = ['admission', 'conference', 'workshop-field-trip'] as const;
const DAY_KEY_SEPARATOR = '::';

interface SanityCardTicketType {
  name: string;
  slug: string;
  price: number | null;
  regularPrice?: number | null;
  capacity?: number | null;
  releasedQuantity?: number | null;
  capacityPool?: string | null;
  headcountPerUnit?: number | null;
  demo?: boolean | null;
}

interface ShowActivation {
  _id: string;
  active: boolean | null;
}

export interface TicketCardViewModelsResult extends TicketCardsOutput {
  /** False when the CMS or the stock read failed: the cards then carry no stock numbers. */
  stockKnown: boolean;
}

const EMPTY_RESULT: TicketCardViewModelsResult = { cards: {}, pool: null, stockKnown: false };

function toTypeInput(
  t: SanityCardTicketType,
  priceBySlug: Record<string, number | null>,
  withStock: boolean,
): TicketTypeInput {
  const sibling = REGULAR_PRICE_SIBLING_SLUG[t.slug];
  return {
    slug: t.slug,
    name: t.name,
    price: t.price ?? null,
    // The early-bird SKUs carry no regular price of their own: the sibling SKU's live price is it.
    regularPrice: sibling ? (priceBySlug[sibling] ?? null) : null,
    capacity: withStock ? (t.capacity ?? null) : null,
    releasedQuantity: withStock ? (t.releasedQuantity ?? null) : null,
    capacityPool: t.capacityPool ?? null,
    headcountPerUnit: t.headcountPerUnit ?? 1,
  };
}

function splitSoldByDay(counts: Record<string, number>): Record<string, Record<string, number>> {
  const byDay: Record<string, Record<string, number>> = {};
  for (const [key, count] of Object.entries(counts)) {
    const at = key.indexOf(DAY_KEY_SEPARATOR);
    if (at < 0) continue;
    const slug = key.slice(0, at);
    const day = key.slice(at + DAY_KEY_SEPARATOR.length);
    byDay[slug] = { ...byDay[slug], [day]: count };
  }
  return byDay;
}

interface StockReading {
  sold: Record<string, number>;
  byDay: Record<string, Record<string, number>>;
}

async function readStock(): Promise<StockReading | null> {
  try {
    const [sold, soldDayKeys] = await Promise.all([
      getSoldCountsByTicketType(NATIONAL_SHOW_ID),
      getSoldCountsByTicketTypeAndDay(NATIONAL_SHOW_ID, new Set(DAY_VISITOR_SHAPED_SLUGS)),
    ]);
    return { sold, byDay: splitSoldByDay(soldDayKeys) };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[lib/data/admission-availability] stock read failed (${name})`);
    return null;
  }
}

/**
 * Every ticket card of the keepsake hub, from real stock only (R7). One loader for the hub, the
 * conferences page and the workshops page, so the three never disagree. The sold-out verdict is
 * the same pooled-capacity check checkout runs. A failure is logged by error name and yields
 * cards with no stock numbers, never an exception and never a sample figure.
 */
export async function loadTicketCardViewModels(): Promise<TicketCardViewModelsResult> {
  try {
    const [byCategory, shows] = await Promise.all([
      Promise.all(
        TICKET_CATEGORIES.map((category) =>
          sanityFetch<SanityCardTicketType[]>({
            query: activeTicketTypesByCategoryQuery,
            params: { category },
            tags: ['ticketType', 'sanity'],
          }),
        ),
      ),
      sanityFetch<ShowActivation[]>({ query: activeShowWindowQuery, tags: ['show', 'sanity'] }),
    ]);
    const cmsTypes = filterPubliclyListableTicketTypes(byCategory.flatMap((rows) => rows ?? []));
    const priceBySlug: Record<string, number | null> = Object.fromEntries(
      cmsTypes.map((t) => [t.slug, t.price ?? null]),
    );
    const stock = await readStock();

    const types: TicketTypeInput[] = cmsTypes.map((t) =>
      toTypeInput(t, priceBySlug, stock !== null),
    );
    // Workshops are priced per session; the product card carries the per-session price and no
    // stock figure (each session shows its own places).
    types.push({
      slug: WORKSHOPS_PRODUCT_SLUG,
      name: null,
      price: WORKSHOP_SESSION_PRICE,
      regularPrice: null,
      capacity: null,
      releasedQuantity: null,
      capacityPool: null,
      headcountPerUnit: 1,
    });

    const built = buildTicketCardViewModels({
      showDays: DAY_VISITOR_SELLABLE_DAYS,
      types,
      soldByType: stock ? stock.sold : {},
      soldByDay: stock ? stock.byDay : null,
    });

    if (stock) {
      const sources: AdmissionAvailabilitySource[] = [];
      for (const t of cmsTypes) {
        if (typeof t.capacity !== 'number') continue;
        sources.push({
          slug: t.slug,
          capacity: t.capacity,
          releasedQuantity: t.releasedQuantity,
          capacityPool: t.capacityPool,
          headcountPerUnit: t.headcountPerUnit,
        });
      }
      const verdict = await getAdmissionSoldOutBySlug(sources, resolveActiveShow(shows ?? []));
      for (const card of Object.values(built.cards)) {
        if (card && card.state !== 'pricePending' && verdict[card.slug] === true) {
          card.state = 'soldOut';
        }
      }
    }
    return { ...built, stockKnown: stock !== null };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[lib/data/admission-availability] ticket cards load failed (${name})`);
    return EMPTY_RESULT;
  }
}
