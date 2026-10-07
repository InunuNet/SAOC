// lib/view-models/ticket-card.ts
//
// F6 (conference-workshop-tickets, M4) — pure view-model interfaces plus the one pure
// precedence resolver this feature's loaders wire against. Zero JSX, zero Tailwind class,
// zero styled component — see
// .agent/memory/project/specs/conference-workshop-tickets/goldens/f3-ui-render-states.golden.md
// §1/Addendum. These are data shapes only; the NOS design peer session's F7 handoff is
// what actually renders them.

/**
 * Precedence order is significant and MUST be applied in this exact sequence — each state
 * masks every state below it. A sold-out EB product with a pending price read is
 * 'pricePending', never 'earlyBirdSoldOut'; a sold-out product that still has a resolvable
 * price is 'soldOut', never 'low'.
 */
export type TicketCardState =
  | 'pricePending' // 1 (highest) — price/capacity data failed to resolve or is mid-fetch
  | 'soldOut' // 2 — remaining <= 0 for a non-early-bird product, or for an
  //     early-bird-ineligible product's own ceiling
  | 'earlyBirdSoldOut' // 3 — remaining <= 0 specifically on an early-bird pool/slug,
  //     distinguished from plain soldOut so the design peer can render
  //     pool-exhaustion language different from a flat sellout
  | 'low' // 4 — remaining > 0 and remaining <= LOW_STOCK_THRESHOLD_PERCENT of total capacity
  | 'available'; // 5 (lowest/default) — remaining > low-stock threshold

export const LOW_STOCK_THRESHOLD_PERCENT = 10;

export interface ScarcityLine {
  remaining: number; // real, race-consistent count — see load-ticket-card.ts §2; never
  // null for any product this feature covers
  total: number;
  label: string; // e.g. "12 of 80 places left" — plain text, no markup
}

export interface TicketCardViewModel {
  slug: string;
  state: TicketCardState;
  price: number | null; // null only when state === 'pricePending'
  regularPrice: number | null; // non-null ONLY for the two early-bird SKUs — see
  // load-ticket-card.ts's "sourced, not re-typed" rule. null for every
  // other in-scope product (no sibling relation).
  scarcity: ScarcityLine | null; // the product's own single-pool/direct-capacity reading.
  // null for day-visitor (no single pool — see `days` below) and,
  // specifically, for weekend-pass when its own ticketType.capacity is
  // itself unset/null. null for any other in-scope product's `scarcity`
  // is a defect, not a valid state.
  days: Array<{
    day: string; // ISO date, e.g. '2027-09-24'
    state: TicketCardState; // this day's OWN state — one day can be soldOut while a
    // sibling day is still available; a single card-level state
    // cannot express that, so each day carries its own
    remaining: number;
    total: number;
  }> | null; // PRESENT (non-null) ONLY for day-qualified products (day-visitor,
  // early-bird) — one entry per sellable ISO date, Fri/Sat/Sun order.
  // early-bird populates BOTH `days` AND `scarcity` simultaneously — it
  // has two independent ceilings, so it needs two independent readings.
}

export interface PresenterCardViewModel {
  id: string; // conferencePresenter document _id
  name: string;
  role: string | null;
  bioExcerpt: string | null; // raw text, no truncation/formatting applied here
  photoUrl: string | null; // null when no photo asset exists yet (real state today)
  event: 'saoc-symposium' | 'wosa-conference';
  order: number;
}

export interface WorkshopSessionViewModel {
  id: string;
  title: string;
  description: string | null;
  presenterId: string | null; // reference to a PresenterCardViewModel.id, or null
  timeSlot: string | null; // free text as entered in Sanity, never a fabricated time
  ticketCard: TicketCardViewModel | null; // null until a real ticketType is linked
}

/**
 * Pure precedence resolver (golden Addendum) — first match wins, 1 highest:
 *   1. !priceUsable -> pricePending
 *   2. remaining !== null && remaining <= 0 -> soldOut
 *   3. earlyBirdRemaining !== null && earlyBirdRemaining <= 0 -> earlyBirdSoldOut
 *   4. remaining !== null && total > 0 && (remaining/total)*100 <= LOW_STOCK_THRESHOLD_PERCENT
 *      -> low
 *   5. otherwise -> available
 *
 * `remaining: null` means "no pool tracked for this product" (day-visitor's own bare
 * scarcity) — such a card can still resolve pricePending but never soldOut/low from a null
 * remaining. The loader calls this once per independent ceiling (card-level scarcity, each
 * day, the shared early-bird pool) — never one collapsed call mixing two ceilings together.
 */
export function resolveTicketCardState(input: {
  priceUsable: boolean;
  remaining: number | null;
  total: number;
  earlyBirdRemaining: number | null;
}): TicketCardState {
  if (!input.priceUsable) return 'pricePending';
  if (input.remaining !== null && input.remaining <= 0) return 'soldOut';
  if (input.earlyBirdRemaining !== null && input.earlyBirdRemaining <= 0) return 'earlyBirdSoldOut';
  if (
    input.remaining !== null &&
    input.total > 0 &&
    (input.remaining / input.total) * 100 <= LOW_STOCK_THRESHOLD_PERCENT
  ) {
    return 'low';
  }
  return 'available';
}
