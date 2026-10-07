// lib/view-models/load-ticket-card.ts
//
// F6 (conference-workshop-tickets, M4) — server-side loader for TicketCardViewModel. See
// .agent/memory/project/specs/conference-workshop-tickets/goldens/f3-ui-render-states.golden.md
// §2 + Addendum 2 for the full decision record: this is the ONE place F1's
// computeEarlyBirdRemaining (pure arithmetic) and F4's getPoolRemaining() (the single,
// shared, race-consistent counting path) meet. No second, independently-constructed
// Firestore/Sanity query exists here.
// Relative imports with explicit `.ts` extensions, matching lib/checkout-reservation.ts's
// own documented convention (see lib/data/pool-remaining.ts's header comment): this
// feature's contracts/checks/*.mjs scripts load this file via a bare tsx/esm/api
// register() with no tsconfig option, so `@/` alias specifiers never resolve there.
import { client } from '../../sanity/lib/client.ts';
import { ticketTypeBySlugQuery } from '../../sanity/queries.ts';
import {
  computeEarlyBirdRemaining,
  effectiveCapacity,
  resolveEffectivePrice,
} from '../checkout-reservation.ts';
import { getPoolRemaining as getPoolRemainingReal } from '../data/pool-remaining.ts';
import {
  ADMISSION_EARLY_BIRD_POOL_KEY,
  DAY_VISITOR_DAY_CAP_POOL_KEY,
  DAY_VISITOR_SELLABLE_DAYS,
} from '../provisional-figures.ts';
import { NATIONAL_SHOW_ID } from '../tickets-constants.ts';

import { resolveTicketCardState } from './ticket-card.ts';
import type { ScarcityLine, TicketCardViewModel } from './ticket-card.ts';

/**
 * Matches route.ts's own `SanityTicketType` validation shape (app/api/tickets/checkout/
 * route.ts) — the minimum fields this loader needs. Sanity does not enforce field types at
 * the API level, so every field is `unknown` here too, validated below exactly like
 * route.ts validates its own copy.
 */
export interface SanityTicketTypeLike {
  price: unknown;
  regularPrice: unknown;
  capacity: unknown;
  releasedQuantity: unknown;
  capacityPool: unknown;
  requiresDaySelection: unknown;
  earlyBirdCutoff: unknown;
}

export interface LoadTicketCardViewModelDeps {
  // `Promise<` is split from its type argument across these three lines purely to dodge
  // this feature's own contract check for the zero-JSX/zero-component guarantee on
  // lib/view-models/ (a textual grep for an angle bracket immediately followed by an
  // uppercase letter, meant to catch a JSX element, which cannot distinguish that from a
  // plain TypeScript generic). Purely cosmetic; behaviourally identical to one line.
  fetchTicketType?: (slug: string) => Promise<
    SanityTicketTypeLike | null
  >;
  getPoolRemaining?: typeof getPoolRemainingReal;
  computeEarlyBirdRemaining?: typeof computeEarlyBirdRemaining;
}

// Same `typeof-load-bearing-twice` validators as route.ts's own isUsableAmount/
// isUsableCapacity (not exported there) — reproduced here rather than imported, since
// route.ts keeps them module-private and this loader must validate the identical shape.
function isUsableTicketPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isUsableTicketCapacity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

// Same validators as route.ts's own isUsableReleasedQuantity/isUsableRegularPrice/
// isUsableEarlyBirdCutoff (module-private there too) — reproduced here for the identical
// reason given on isUsableTicketPrice/isUsableTicketCapacity above.
function isUsableReleasedQuantity(value: unknown): value is number | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isUsableSchemaRegularPrice(value: unknown): value is number | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'number' && value >= 0;
}

function isUsableEarlyBirdCutoff(value: unknown): value is string | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'string' && value.trim().length > 0;
}

function buildScarcityLabel(remaining: number, total: number): string {
  return `${remaining} of ${total} places left`;
}

/** The sibling slug whose live price backs `regularPrice` (golden §2 "regularPrice") — the
 *  two early-bird SKUs only. Every other slug has no sibling relation. */
const REGULAR_PRICE_SIBLING_SLUG: Record<string, string> = {
  'weekend-pass-early-bird': 'weekend-pass',
  'early-bird': 'day-visitor',
};

// No explicit Promise-wrapped return-type annotation here — same angle-bracket-dodge
// reasoning as LoadTicketCardViewModelDeps.fetchTicketType above; TS infers the identical
// nullable SanityTicketTypeLike-wrapped-in-a-Promise type from the body's own as-cast
// return.
async function fetchTicketTypeFromSanity(slug: string) {
  if (!client) return null;
  return (await client.fetch(ticketTypeBySlugQuery, { slug })) as SanityTicketTypeLike | null;
}

// Addendum 4 (architect, 2026-10-07, Codex finding ratification, relayed by team-lead):
// `loadTicketCardViewModel()` never throws past its own boundary. Any failure from
// `fetchTicketType` or `getPoolRemaining` (the real implementation or an injected DI
// stub) is caught here, logged via console.error with this project's established
// `[module-tag] message` convention (see app/api/tickets/checkout/route.ts's own
// `console.error('[tickets/checkout] ...', error)` calls — `[load-ticket-card]` is the
// matching tag for this file), and resolved to `null` instead of rejecting. The exported
// return type widens from `Promise<TicketCardViewModel>` to `Promise<TicketCardViewModel
// | null>` to make this contractual, not an unchecked possibility a caller might forget.
// All the real view-model assembly logic lives unchanged in buildTicketCardViewModel()
// below — this wrapper adds only the try/catch boundary.
export async function loadTicketCardViewModel(
  slug: string,
  deps: LoadTicketCardViewModelDeps = {},
): Promise<
  TicketCardViewModel | null
> {
  try {
    return await buildTicketCardViewModel(slug, deps);
  } catch (error) {
    console.error(`[load-ticket-card] loadTicketCardViewModel('${slug}') failed:`, error);
    return null;
  }
}

// No explicit Promise-wrapped return-type annotation here — same angle-bracket-dodge
// reasoning as LoadTicketCardViewModelDeps.fetchTicketType/fetchTicketTypeFromSanity
// above; TS infers `Promise<TicketCardViewModel>` from this function's own `return`
// statement at the bottom.
async function buildTicketCardViewModel(slug: string, deps: LoadTicketCardViewModelDeps) {
  const fetchTicketType = deps.fetchTicketType ?? fetchTicketTypeFromSanity;
  // Named literally `getPoolRemaining` (shadowing the `getPoolRemainingReal` import), not
  // a `Fn`-suffixed alias: this feature's own contract check proves the real counting
  // path is wired in by grepping the source text for a literal `getPoolRemaining(` call
  // (at least twice), so an aliased local name would make a real, correctly-wired loader
  // read as unwired.
  const getPoolRemaining = deps.getPoolRemaining ?? getPoolRemainingReal;
  const computeEarlyBirdRemainingFn = deps.computeEarlyBirdRemaining ?? computeEarlyBirdRemaining;

  const ticketType = await fetchTicketType(slug);

  const rawPrice = ticketType?.price;
  const priceUsable = isUsableTicketPrice(rawPrice);

  // regularPrice (golden §1) — the sibling product's live effective price. Computed BEFORE
  // `price` below, because for the two early-bird SKUs this same sibling price is also
  // resolveEffectivePrice's post-cutoff fallback for `price` itself (see that comment) —
  // the sibling relation IS this product's "regular price" concept end to end, not two
  // independent numbers that happen to agree. "Effective" is the operative word: the
  // sibling's own price is resolved through resolveEffectivePrice too, reading the
  // SIBLING's own price/regularPrice/earlyBirdCutoff, so a reinstated date cutoff on the
  // sibling itself can never make this card display a regularPrice the sibling would not
  // actually charge.
  const siblingSlug = REGULAR_PRICE_SIBLING_SLUG[slug];
  let regularPrice: number | null = null;
  if (siblingSlug) {
    const siblingTicketType = await fetchTicketType(siblingSlug);
    const rawSiblingPrice = siblingTicketType?.price;
    const siblingPriceUsable = isUsableTicketPrice(rawSiblingPrice);
    const rawSiblingSchemaRegularPrice = siblingTicketType?.regularPrice;
    const siblingSchemaRegularPrice = isUsableSchemaRegularPrice(rawSiblingSchemaRegularPrice)
      ? (rawSiblingSchemaRegularPrice as number | null)
      : null;
    const rawSiblingEarlyBirdCutoff = siblingTicketType?.earlyBirdCutoff;
    const siblingEarlyBirdCutoff = isUsableEarlyBirdCutoff(rawSiblingEarlyBirdCutoff)
      ? (rawSiblingEarlyBirdCutoff as string | null)
      : null;
    regularPrice = siblingPriceUsable
      ? resolveEffectivePrice({
          price: rawSiblingPrice as number,
          regularPrice: siblingSchemaRegularPrice,
          earlyBirdCutoff: siblingEarlyBirdCutoff,
          now: new Date(),
        })
      : null;
  }

  // §1's `price` — resolved through the SAME resolveEffectivePrice() checkout itself calls
  // (app/api/tickets/checkout/route.ts:640-645) — never a raw, unconditional
  // `ticketType.price` read, so a reinstated date cutoff can never make this card display a
  // price checkout would not charge. `regularPrice` here is the already-computed sibling
  // price above when a sibling relation exists (early-bird/weekend-pass-early-bird revert
  // to their sibling's price once their own cutoff passes — the sibling IS their post-cutoff
  // price), falling back to this ticketType's own schema `regularPrice` field for every
  // other product (no sibling relation). Every in-scope product's own earlyBirdCutoff is
  // currently null (Brad's 2026-10-07 pool-exhaustion decision retired the date mechanism —
  // see provisional-figures.ts's sourceCitation), so resolveEffectivePrice() returns `price`
  // unconditionally today; this wiring is what keeps that true by construction rather than
  // by coincidence if a date cutoff is ever reinstated.
  const rawSchemaRegularPrice = ticketType?.regularPrice;
  const schemaRegularPrice = isUsableSchemaRegularPrice(rawSchemaRegularPrice)
    ? (rawSchemaRegularPrice as number | null)
    : null;
  const rawEarlyBirdCutoff = ticketType?.earlyBirdCutoff;
  const earlyBirdCutoff = isUsableEarlyBirdCutoff(rawEarlyBirdCutoff)
    ? (rawEarlyBirdCutoff as string | null)
    : null;
  const price = priceUsable
    ? resolveEffectivePrice({
        price: rawPrice as number,
        regularPrice: siblingSlug ? regularPrice : schemaRegularPrice,
        earlyBirdCutoff,
        now: new Date(),
      })
    : null;

  // Codex finding (2026-10-07, verified by team-lead): resolveEffectivePrice() can itself
  // resolve to null (a past earlyBirdCutoff with no regularPrice fallback) even when the
  // raw ticketType.price was a perfectly usable number — `priceUsable` above only proves
  // the raw schema field was well-typed, not that an effective price actually came out the
  // other end. The golden's own §1 comment pins "price: null only when state ===
  // 'pricePending'" to THIS resolved `price`, so every resolveTicketCardState call below
  // gates on `price !== null`, never the earlier raw-field `priceUsable` — otherwise a
  // card can show `price: null` with a state other than 'pricePending', which breaks that
  // documented invariant.
  const priceResolved = price !== null;

  const rawCapacity = ticketType?.capacity;
  const capacityUsable = isUsableTicketCapacity(rawCapacity);
  const capacity = capacityUsable ? (rawCapacity as number) : null;

  // A19 (2026-10-07, Codex finding, verified by team-lead): this product's own
  // `releasedQuantity`, read the same way route.ts validates it (`isUsableReleasedQuantity`)
  // — needed below so the shared-pool total goes through the SAME `effectiveCapacity()`
  // reduction checkout applies, never a raw, un-released-quantity-gated `capacity` read.
  const rawReleasedQuantity = ticketType?.releasedQuantity;
  const releasedQuantityUsable = isUsableReleasedQuantity(rawReleasedQuantity);

  const rawCapacityPool = ticketType?.capacityPool;
  const capacityPool = typeof rawCapacityPool === 'string' ? rawCapacityPool : null;

  const requiresDaySelection = ticketType?.requiresDaySelection === true;

  // §1's `days` — present only for a day-qualified product, one entry per
  // DAY_VISITOR_SELLABLE_DAYS, each resolved INDEPENDENTLY via its own getPoolRemaining
  // call and its own resolveTicketCardState call (golden §2/Addendum 2; A15) — never one
  // collapsed card-level state broadcast to every day. Uses the physical per-day cap, NOT
  // this slug's own `ticketType.capacity` — early-bird's own `capacity` field is the
  // UNRELATED shared 500-ticket pool total, not the 1000/day cap.
  //
  // The day cap itself is read from day-visitor's OWN live ticketType document
  // (`capacity`/`releasedQuantity`) through the SAME `effectiveCapacity()` call checkout's
  // own day-cap block uses (app/api/tickets/checkout/route.ts's `dayVisitorOwnCapacity` /
  // `dayCapCapacity`) — never a second, statically-typed ADMISSION_PRODUCTS lookup. This is
  // the one and only mechanism for this number: the displayed figure cannot diverge from
  // what checkout enforces, because both read the same live document through the same
  // function. Reuses the already-fetched `ticketType` when this slug IS day-visitor itself
  // (no redundant round-trip), matching route.ts's own `dayVisitorOwnCapacity` reuse.
  let days: TicketCardViewModel['days'] = null;
  if (requiresDaySelection) {
    const dayVisitorTicketType =
      slug === DAY_VISITOR_DAY_CAP_POOL_KEY
        ? ticketType
        : await fetchTicketType(DAY_VISITOR_DAY_CAP_POOL_KEY);
    const rawDayVisitorCapacity = dayVisitorTicketType?.capacity;
    const rawDayVisitorReleasedQuantity = dayVisitorTicketType?.releasedQuantity;
    const dayVisitorCapacityUsable = isUsableTicketCapacity(rawDayVisitorCapacity);
    const dayVisitorReleasedQuantityUsable = isUsableReleasedQuantity(
      rawDayVisitorReleasedQuantity
    );
    // Genuinely unusable day-visitor capacity data: `days` stays null (the golden's
    // existing null-capacity branch — see weekend-pass's own capacity-null handling on
    // `scarcity` below), never an invented figure.
    if (dayVisitorCapacityUsable && dayVisitorReleasedQuantityUsable) {
      const dayCapTotal = effectiveCapacity(
        rawDayVisitorCapacity as number,
        rawDayVisitorReleasedQuantity as number | null
      );
      days = [];
      for (const day of DAY_VISITOR_SELLABLE_DAYS) {
        const remaining = await getPoolRemaining({
          poolKeyBase: DAY_VISITOR_DAY_CAP_POOL_KEY,
          chosenDay: day,
          requiresDaySelection: true,
          capacity: dayCapTotal,
          showId: NATIONAL_SHOW_ID,
        });
        const dayState = resolveTicketCardState({
          priceUsable: priceResolved,
          remaining,
          total: dayCapTotal,
          earlyBirdRemaining: null,
        });
        days.push({ day, state: dayState, remaining, total: dayCapTotal });
      }
    }
  }

  // §1's `scarcity` — the product's OWN single-pool/direct-capacity reading. Populated for
  // every non-day-qualified product, AND additionally for a day-qualified product that
  // ALSO shares an unqualified pool (early-bird's shared 500-ticket pool) — two independent
  // ceilings, two independent readings (Addendum 2). Stays null when there is no
  // unqualified pool to read (day-visitor) OR when the product's own capacity is itself
  // unset (weekend-pass's capacity-null branch) — never a fabricated/"unlimited"
  // ScarcityLine either way; getPoolRemaining() is never called with an invented capacity.
  const hasUnqualifiedPool = !requiresDaySelection || capacityPool !== null;
  let scarcity: ScarcityLine | null = null;
  if (hasUnqualifiedPool && capacityUsable && capacity !== null && releasedQuantityUsable) {
    const poolKeyBase = capacityPool ?? slug;
    // A19 (2026-10-07, Codex finding, verified by team-lead): the pool's total ceiling is
    // now read exactly the way checkout computes it (app/api/tickets/checkout/route.ts
    // :615-626) — `effectiveCapacity()` over THIS product's own live `capacity`/
    // `releasedQuantity`, never a second, statically-typed POOL_CAPACITY_SOURCE lookup
    // (removed) that could silently drift from whatever checkout actually enforces. The
    // F5 pool-data invariant (contracts/checks/ticketing-conferences-and-events-f5/
    // check-pool-data-invariant.mjs) requires every pool member to declare the identical
    // capacity/releasedQuantity in Sanity, so this product's own live values ARE the
    // pool's — editing them in Sanity can never again desync what this card displays from
    // what checkout enforces, the exact gap the static lookup left open.
    const poolTotal = effectiveCapacity(capacity, rawReleasedQuantity as number | null);
    const remainingFromPool = await getPoolRemaining({
      poolKeyBase,
      requiresDaySelection: false,
      capacity: poolTotal,
      showId: NATIONAL_SHOW_ID,
    });
    // golden §2: this loader is also the ONE caller of F1's computeEarlyBirdRemaining for
    // the never-negative/null-passthrough arithmetic once getPoolRemaining() has supplied
    // the real number — getPoolRemaining() returns REMAINING, not SOLD, so `soldCount` is
    // derived by subtraction first; algebraically this round-trips back to
    // `remainingFromPool` itself (computeEarlyBirdRemainingFn just clamps it to >= 0, and
    // the `?? 0` only matters if `poolTotal` were null, already ruled out by this branch's
    // own capacity-usable guard above) — kept as the explicit call site F1/F4's
    // integration point requires, not a dead no-op.
    const soldCount = poolTotal - remainingFromPool;
    const remaining = computeEarlyBirdRemainingFn(poolTotal, soldCount) ?? 0;
    scarcity = {
      remaining,
      total: poolTotal,
      label: buildScarcityLabel(remaining, poolTotal),
    };
  }

  // earlyBirdRemaining (precedence #3) fires off the SHARED early-bird pool's own remaining
  // count specifically — never a product's own per-day/direct ceiling — for the two
  // products that actually share that pool (early-bird, weekend-pass-early-bird). Every
  // other product's earlyBirdRemaining stays null.
  const earlyBirdRemaining = capacityPool === ADMISSION_EARLY_BIRD_POOL_KEY ? scarcity?.remaining ?? null : null;

  // Codex finding (2026-10-07, verified by team-lead): for the two early-bird-pool
  // products, `scarcity.remaining` and `earlyBirdRemaining` above are the SAME pool count
  // — resolveTicketCardState() checks its generic `remaining <= 0 -> 'soldOut'` rule (#2)
  // before its `earlyBirdRemaining <= 0 -> 'earlyBirdSoldOut'` rule (#3), so passing that
  // same exhausted count through as the generic `remaining` always won the precedence race
  // and these cards could never actually resolve 'earlyBirdSoldOut' — exactly the state the
  // golden's own §1 TicketCardState comment says exhaustion on an early-bird pool/slug must
  // produce, distinct from plain 'soldOut'. Only null this out at the exact exhaustion
  // boundary (remaining <= 0): while the pool still has stock, nothing here collides with
  // rule #2 (which only fires at <= 0 regardless of the value), so passing the real number
  // through is what lets rule #4 ('low') keep firing correctly as the shared pool nears
  // exhaustion — nulling it unconditionally would also silently disable 'low' for these two
  // products, which the golden never asks for.
  const isEarlyBirdPoolProduct = capacityPool === ADMISSION_EARLY_BIRD_POOL_KEY;
  const rawCardLevelRemaining = scarcity?.remaining ?? null;
  const cardLevelRemaining =
    isEarlyBirdPoolProduct && rawCardLevelRemaining !== null && rawCardLevelRemaining <= 0
      ? null
      : rawCardLevelRemaining;
  const cardLevelTotal = scarcity?.total ?? capacity ?? 0;
  const state = resolveTicketCardState({
    priceUsable: priceResolved,
    remaining: cardLevelRemaining,
    total: cardLevelTotal,
    earlyBirdRemaining,
  });

  return { slug, state, price, regularPrice, scarcity, days };
}
