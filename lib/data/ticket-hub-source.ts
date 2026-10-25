// The pure half of the tickets hub: catalogue rows plus a stock reading in, one card per
// product out. Firebase-free and clock-free (the caller supplies `now`), so the hub loader
// (lib/data/admission-availability.ts) and the prerendered /national-show page, which cannot
// reach firebase-admin, derive their products from ONE pipeline and never disagree about
// which products exist.
import { REGULAR_PRICE_SIBLING_SLUG } from '@/lib/admission-siblings';
import { resolveEffectivePrice } from '@/lib/checkout-reservation';
import {
  buildTicketCardViewModels,
  type TicketCardsOutput,
  type TicketTypeInput,
} from '@/lib/data/ticket-card-view-models';
import { WORKSHOPS_PRODUCT_SLUG } from '@/lib/data/ticket-presentation';
import { filterPubliclyListableTicketTypes } from '@/lib/demo-ticket-type';
import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
  WORKSHOP_SESSION_PRICE,
  type ProvisionalAdmissionProduct,
} from '@/lib/provisional-figures';

export const TICKET_CATEGORIES = ['admission', 'conference', 'workshop-field-trip'] as const;

export interface HubCmsTicketType {
  name: string;
  slug: string;
  price: number | null;
  regularPrice?: number | null;
  earlyBirdCutoff?: string | null;
  capacity?: number | null;
  releasedQuantity?: number | null;
  capacityPool?: string | null;
  headcountPerUnit?: number | null;
  demo?: boolean | null;
}

export interface BuildHubCardsInput {
  cmsTypes: readonly HubCmsTicketType[];
  /** The CMS sales switch: false masks every card as salesClosed. */
  salesOpen: boolean;
  soldByType: Readonly<Record<string, number>>;
  soldByDay: Readonly<Record<string, Readonly<Record<string, number>>>> | null;
  /** False when no stock reading exists: the cards then carry no stock numbers. */
  stockKnown: boolean;
  now: Date;
  showDays: readonly string[];
}

// Totals a ticket type carries when Sanity has none: the figures of lib/provisional-figures.ts.
// They still drive the sales logic; the keepsake components decide what to show (hidden on a
// public build, marked on the beta preview).
const PROVISIONAL_STOCK: Readonly<Record<string, ProvisionalAdmissionProduct>> = Object.fromEntries(
  [...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS].map((p) => [
    p.slug,
    p,
  ])
);

function toTypeInput(
  t: HubCmsTicketType,
  priceBySlug: Record<string, number | null>,
  withStock: boolean,
  now: Date
): TicketTypeInput {
  const sibling = REGULAR_PRICE_SIBLING_SLUG[t.slug];
  const sanityStock = typeof t.capacity === 'number' || typeof t.releasedQuantity === 'number';
  const fallback = sanityStock ? undefined : PROVISIONAL_STOCK[t.slug];
  // The early-bird SKUs carry no regular price of their own: the sibling SKU's live price is it.
  const regularPrice = sibling ? (priceBySlug[sibling] ?? null) : null;
  return {
    slug: t.slug,
    name: t.name,
    // The price checkout would charge now: a passed early-bird cutoff falls back to the regular
    // price (null when there is none), never the expired one.
    price:
      typeof t.price !== 'number'
        ? null
        : resolveEffectivePrice({
            price: t.price,
            regularPrice: regularPrice ?? t.regularPrice ?? null,
            earlyBirdCutoff: t.earlyBirdCutoff ?? null,
            now,
          }),
    regularPrice,
    capacity: withStock ? (t.capacity ?? fallback?.capacity ?? null) : null,
    releasedQuantity: withStock ? (t.releasedQuantity ?? fallback?.releasedQuantity ?? null) : null,
    capacityPool: t.capacityPool ?? fallback?.capacityPool ?? null,
    capacitySource: fallback ? 'provisional' : 'sanity',
    headcountPerUnit: t.headcountPerUnit ?? 1,
  };
}

/**
 * Every card of the hub. Demo / QA-fixture types are dropped always: the hub never lists a
 * fixture, even in development.
 */
export function buildHubCards(input: BuildHubCardsInput): TicketCardsOutput {
  const cmsTypes = filterPubliclyListableTicketTypes([...input.cmsTypes]);
  const priceBySlug: Record<string, number | null> = Object.fromEntries(
    cmsTypes.map((t) => [t.slug, t.price ?? null])
  );
  const types: TicketTypeInput[] = cmsTypes.map((t) =>
    toTypeInput(t, priceBySlug, input.stockKnown, input.now)
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

  return buildTicketCardViewModels({
    showDays: input.showDays,
    types,
    soldByType: input.soldByType,
    soldByDay: input.soldByDay,
    salesOpen: input.salesOpen,
  });
}
