// =============================================================
// NOS — lib/data/ticket-card-view-models.ts
// The pure builder behind the keepsake ticket cards (goldens/f18b HANDOFF section 2). It turns
// the ticket types, the real sold counts and the show days into one view model per product slot,
// with no CMS, Firestore or React in reach, so the same inputs always give the same cards.
// The page never re-derives what is decided here: state precedence comes from
// resolveTicketCardState, the shared early-bird pool is counted once, and a count that has no
// real source is null and renders nothing (R7: no sample numbers, ever).
// =============================================================

import { resolveTicketCardState } from '../view-models/ticket-card.ts';
import type { TicketCardState } from '../view-models/ticket-card.ts';
import { PASS_SKUS } from './ticket-presentation.ts';
import type { TicketProductId } from './ticket-presentation.ts';

const POOL_LABEL = 'early-bird left';
const PLACES_LABEL = 'places left';
const EARLY_BIRD_SLUG_MARK = 'early-bird';
const DAY_VISITOR_SLUG = 'day-visitor';

export interface TicketTypeInput {
  slug: string;
  name?: string | null;
  price: number | null;
  regularPrice: number | null;
  capacity: number | null;
  releasedQuantity: number | null;
  capacityPool: string | null;
  headcountPerUnit: number;
  // Where the total comes from: Sanity (default) or lib/provisional-figures.ts. The builder only
  // flags it; the components decide what to show, by mode.
  capacitySource?: 'sanity' | 'provisional';
}

export interface TicketCardsInput {
  showDays: readonly string[];
  types: readonly TicketTypeInput[];
  /** Sold units by ticket type slug. */
  soldByType: Readonly<Record<string, number>>;
  /** Sold units by ticket type slug, then show day; null when no per-day source exists. */
  soldByDay: Readonly<Record<string, Readonly<Record<string, number>>>> | null;
  // False masks every card (state salesClosed, no price, stock or days). Default: open.
  salesOpen?: boolean;
}

export interface CardScarcity {
  remaining: number;
  total: number;
  label: string;
  provisional: boolean;
}

export interface CardDay {
  day: string;
  state: TicketCardState;
  /** null when there is no real per-day count: the cell renders no number. */
  remaining: number | null;
  total: number | null;
  provisional: boolean;
}

export interface TicketCard {
  productId: TicketProductId;
  slug: string;
  name: string | null;
  state: TicketCardState;
  price: number | null;
  regularPrice: number | null;
  regularName: string | null;
  scarcity: CardScarcity | null;
  days: CardDay[] | null;
}

export interface EarlyBirdPool {
  remaining: number;
  total: number;
  provisional: boolean;
}

export interface TicketCardsOutput {
  cards: Partial<Record<TicketProductId, TicketCard>>;
  pool: EarlyBirdPool | null;
  // The Day Pass card's effective price, shown as "Day Pass from"; null when it has none.
  dayPassFrom: number | null;
}

const SINGLE_SLUG_PRODUCTS: ReadonlyArray<readonly [TicketProductId, string]> = [
  ['vip', 'vip'],
  ['sunset', 'sunset-cocktails-single'],
  ['symposium', 'saoc-symposium'],
  ['wosa', 'wosa-conference'],
  ['workshops', 'workshops'],
];

/** Capacity a type can actually sell: its capacity, or the released quantity when smaller. */
function effectiveCapacity(type: TicketTypeInput): number | null {
  const { capacity, releasedQuantity } = type;
  if (capacity === null && releasedQuantity === null) return null;
  if (capacity === null) return releasedQuantity;
  if (releasedQuantity === null) return capacity;
  return Math.min(capacity, releasedQuantity);
}

function isProvisional(type: TicketTypeInput): boolean {
  return type.capacitySource === 'provisional';
}

function isPriceUsable(price: number | null): boolean {
  return price !== null && price >= 0;
}

// Only the Weekend Pass and Day Pass SKUs share the early-bird pool; another product that happens
// to carry a capacity pool (Sunset Cocktails, a field trip) must not change its count.
const POOL_SKUS: ReadonlySet<string> = new Set(
  Object.values(PASS_SKUS).flatMap((sku) => [sku.earlyBird, sku.regular])
);

function buildPool(input: TicketCardsInput): EarlyBirdPool | null {
  const members = input.types.filter((t) => t.capacityPool !== null && POOL_SKUS.has(t.slug));
  const capacities = members.map(effectiveCapacity).filter((c): c is number => c !== null);
  if (capacities.length === 0) return null;
  const total = Math.min(...capacities);
  const sold = members.reduce(
    (sum, t) => sum + (input.soldByType[t.slug] ?? 0) * t.headcountPerUnit,
    0
  );
  const provisional = members.some((t) => isProvisional(t));
  return { remaining: Math.max(0, total - sold), total, provisional };
}

function ownScarcity(type: TicketTypeInput, sold: number): CardScarcity | null {
  const total = effectiveCapacity(type);
  if (total === null) return null;
  return {
    remaining: Math.max(0, total - sold),
    total,
    label: PLACES_LABEL,
    provisional: isProvisional(type),
  };
}

/** Day Pass per-day readings: of the day-visitor ceiling, from real sold-by-day counts only. */
function buildDays(
  input: TicketCardsInput,
  type: TicketTypeInput,
  priceUsable: boolean
): CardDay[] {
  const ceilingType = input.types.find((t) => t.slug === DAY_VISITOR_SLUG) ?? type;
  const total = effectiveCapacity(ceilingType);
  const provisional = isProvisional(type) || isProvisional(ceilingType);
  const bySku = input.soldByDay;
  const hasSource = bySku !== null && total !== null;
  return input.showDays.map((day) => {
    if (!hasSource) {
      const state = resolveTicketCardState({
        priceUsable,
        remaining: null,
        total: 0,
        earlyBirdRemaining: null,
      });
      return { day, state, remaining: null, total: null, provisional };
    }
    const sold = [PASS_SKUS.day.earlyBird, PASS_SKUS.day.regular].reduce(
      (sum, slug) => sum + (bySku[slug]?.[day] ?? 0),
      0
    );
    const remaining = Math.max(0, total - sold);
    const state = resolveTicketCardState({
      priceUsable,
      remaining,
      total,
      earlyBirdRemaining: null,
    });
    return { day, state, remaining, total, provisional };
  });
}

function allDaysSoldOut(days: CardDay[]): boolean {
  return days.length > 0 && days.every((d) => d.remaining !== null && d.remaining <= 0);
}

function buildSingleCard(
  productId: TicketProductId,
  type: TicketTypeInput,
  input: TicketCardsInput
): TicketCard {
  const priceUsable = isPriceUsable(type.price);
  const scarcity = ownScarcity(type, input.soldByType[type.slug] ?? 0);
  const state = resolveTicketCardState({
    priceUsable,
    remaining: scarcity ? scarcity.remaining : null,
    total: scarcity ? scarcity.total : 0,
    earlyBirdRemaining: null,
  });
  return {
    productId,
    slug: type.slug,
    name: type.name ?? null,
    state,
    price: priceUsable ? type.price : null,
    regularPrice: null,
    regularName: null,
    scarcity,
    days: null,
  };
}

function buildPassCard(
  productId: 'weekend' | 'day',
  input: TicketCardsInput,
  pool: EarlyBirdPool | null
): TicketCard | null {
  const skus = PASS_SKUS[productId];
  const earlyBird = input.types.find((t) => t.slug === skus.earlyBird) ?? null;
  const regular = input.types.find((t) => t.slug === skus.regular) ?? null;
  // With no readable pool (stock unknown) the early-bird SKU keeps the slot and shows no count.
  const poolOpen = pool === null || pool.remaining > 0;
  // While the pool lasts the early-bird SKU holds the slot; at 0 the regular SKU takes it.
  const type = poolOpen ? (earlyBird ?? regular) : (regular ?? earlyBird);
  if (!type) return null;

  const isEarlyBirdSku = type.slug.includes(EARLY_BIRD_SLUG_MARK) && type.slug !== regular?.slug;
  const priceUsable = isPriceUsable(type.price);
  const days = productId === 'day' ? buildDays(input, type, priceUsable) : null;

  let scarcity: CardScarcity | null;
  let state: TicketCardState;
  if (isEarlyBirdSku && pool) {
    scarcity = {
      remaining: pool.remaining,
      total: pool.total,
      label: POOL_LABEL,
      provisional: pool.provisional,
    };
    state = poolOpen
      ? resolveTicketCardState({
          priceUsable,
          remaining: pool.remaining,
          total: pool.total,
          earlyBirdRemaining: pool.remaining,
        })
      : resolveTicketCardState({
          priceUsable,
          remaining: null,
          total: 0,
          earlyBirdRemaining: pool.remaining,
        });
  } else if (productId === 'day') {
    // The regular Day Pass has no single ceiling: its per-day readings carry the scarcity.
    scarcity = null;
    state = resolveTicketCardState({
      priceUsable,
      remaining: null,
      total: 0,
      earlyBirdRemaining: null,
    });
  } else {
    scarcity = ownScarcity(type, input.soldByType[type.slug] ?? 0);
    state = resolveTicketCardState({
      priceUsable,
      remaining: scarcity ? scarcity.remaining : null,
      total: scarcity ? scarcity.total : 0,
      earlyBirdRemaining: null,
    });
  }
  if (days && priceUsable && allDaysSoldOut(days)) state = 'soldOut';

  return {
    productId,
    slug: type.slug,
    name: type.name ?? null,
    state,
    price: priceUsable ? type.price : null,
    regularPrice: type.slug.includes(EARLY_BIRD_SLUG_MARK) ? type.regularPrice : null,
    regularName: type.slug.includes(EARLY_BIRD_SLUG_MARK) ? (regular?.name ?? null) : null,
    scarcity,
    days,
  };
}

/**
 * One card per product slot. A product whose ticket type does not exist gets no card: nothing
 * is invented to fill the gap.
 */
function maskForClosedSales(card: TicketCard): TicketCard {
  return {
    ...card,
    state: 'salesClosed',
    price: null,
    regularPrice: null,
    regularName: null,
    scarcity: null,
    days: null,
  };
}

export function buildTicketCardViewModels(input: TicketCardsInput): TicketCardsOutput {
  const pool = buildPool(input);
  const cards: Partial<Record<TicketProductId, TicketCard>> = {};

  for (const [productId, slug] of SINGLE_SLUG_PRODUCTS) {
    const type = input.types.find((t) => t.slug === slug);
    if (type) cards[productId] = buildSingleCard(productId, type, input);
  }
  // No workshop session exists to book (no ticket type, no schedule), so the Workshops card
  // takes the no-price, no-button state until the sessions do (F18c).
  if (cards.workshops) {
    cards.workshops = { ...cards.workshops, state: 'pricePending', price: null, scarcity: null };
  }
  const weekend = buildPassCard('weekend', input, pool);
  if (weekend) cards.weekend = weekend;
  const day = buildPassCard('day', input, pool);
  if (day) cards.day = day;

  if (input.salesOpen === false) {
    for (const id of Object.keys(cards) as TicketProductId[]) {
      const card = cards[id];
      if (card) cards[id] = maskForClosedSales(card);
    }
    return { cards, pool: null, dayPassFrom: null };
  }
  return { cards, pool, dayPassFrom: cards.day?.price ?? null };
}
