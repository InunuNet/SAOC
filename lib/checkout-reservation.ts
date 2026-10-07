import type { Timestamp } from 'firebase-admin/firestore';

// Relative, not `@/`-aliased: this project's contracts/checks/*.mjs scripts load this
// file directly — some via a bare `tsx/esm/api` register() with no tsconfig option
// passed (contracts/checks/conference-workshop-tickets-f4/_lib.mjs), others via Node's
// own native TypeScript support with no tsx at all (e.g.
// contracts/checks/ticketing-f5-day-attendees/check-attendee-name-requirement.mjs) —
// neither resolves the `@/` path alias, and Node's native resolver additionally needs
// the explicit `.ts` extension on a relative specifier (unlike tsx's bundler-style
// resolver, it does not probe extensions). See lib/show-window-lookup.ts's own
// sibling-lib imports for the same relative-import precedent.
import {
  getSoldCountsByTicketType as getSoldCountsByTicketTypeReal,
  getSoldCountsByTicketTypeAndDay as getSoldCountsByTicketTypeAndDayReal,
} from './data/tickets.ts';
import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  DAY_VISITOR_DAY_CAP_POOL_KEY,
  DAY_VISITOR_SHAPED_SLUGS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
} from './provisional-figures.ts';
import type { Order, Ticket, TicketType } from '@/types/index';

/**
 * F2/F6/F10 follow-up (ticketing-foundation) — checkout's own order/position construction
 * and pair-write primitive (spec §4.2/§4.4/§8.2). See
 * contracts/golden/ticketing-checkout-orders/README.md for the full decision record,
 * including why this is a NEW sibling module rather than an extension of lib/orders.ts.
 *
 * `buildReservationDocs` is pure — no Firestore import, no Date.now()/new Date() call
 * anywhere in this file. Time is always the caller-supplied `now`, exactly like
 * lib/recovery-token.ts's own pattern.
 */

export interface BuildReservationDocsInput {
  orderId: string;
  bookingRef: string;
  showId: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketType: TicketType;
  amount: number;
  idempotencyKey: string;
  expiresAt: Timestamp;
  recoveryToken: string;
  recoveryTokenExpiresAt: Timestamp;
  now: Timestamp;
  /** F2 (ozow-payment-provider) — the RESOLVED providerId the caller validated (checkout/route.ts's
   *  own gate), never re-derived and never defaulted here. Replaces the formerly hardcoded
   *  PAYFAST_GATEWAY constant — see contracts/golden/ozow-m1-f2/README.md §3. */
  gateway: string;
}

export interface ReservationDocs {
  order: Omit<Order, 'id'>;
  position: Omit<Ticket, 'id'> & { idempotencyKey: string };
}

/**
 * Builds the order body and the position body for a fresh checkout reservation. Pure
 * construction only — the caller writes both via `writeReservationPair()` inside its own
 * already-open transaction.
 *
 * `buyerName`/`buyerEmail` are set to `attendeeName`/`attendeeEmail` — checkout's request
 * body has no separate buyer fields (see README "buyerName/buyerEmail ==
 * attendeeName/attendeeEmail, for now").
 */
export function buildReservationDocs(input: BuildReservationDocsInput): ReservationDocs {
  const order: Omit<Order, 'id'> = {
    showId: input.showId,
    buyerName: input.attendeeName,
    buyerEmail: input.attendeeEmail,
    amount: input.amount,
    status: 'reserved',
    expiresAt: input.expiresAt,
    idempotencyKey: input.idempotencyKey,
    purchasedAt: null,
    gateway: input.gateway,
    gatewayPaymentId: null,
    m_payment_id: input.bookingRef,
    pf_payment_id: null,
    recoveryToken: input.recoveryToken,
    recoveryTokenExpiresAt: input.recoveryTokenExpiresAt,
    // ozow-sandbox-toggle F1 — this builder is not the live checkout call path (see
    // BuildMultiReservationDocsInput's own comment above); always null, same as every
    // pre-F1 order.
    expectedGatewayAmount: null,
  };

  const position: Omit<Ticket, 'id'> & { idempotencyKey: string } = {
    bookingRef: input.bookingRef,
    showId: input.showId,
    attendeeName: input.attendeeName,
    attendeeEmail: input.attendeeEmail,
    ticketType: input.ticketType,
    status: 'reserved',
    amount: input.amount,
    purchasedAt: null,
    checkedInAt: null,
    m_payment_id: input.bookingRef,
    pf_payment_id: null,
    orderId: input.orderId,
    compedBy: null,
    expiresAt: input.expiresAt,
    idempotencyKey: input.idempotencyKey,
  };

  return { order, position };
}

// ---------------------------------------------------------------------------------------------
// Deliberately narrow structural interface matching ONLY `transaction.create(ref, data)` — the
// one method this module calls. A NEW sibling, not an extension of lib/orders.ts's
// OrdersTransactionLike/OrdersTransactionRwLike families (neither has `create`) — same reasoning
// as F10's own "why two interface families, not one widened one"
// (contracts/golden/ticketing-f10-itn-repin/README.md). This is what lets the REAL firebase-admin
// Transaction class, and checkout's already-open transaction, satisfy the interface with zero
// adapter code.
// ---------------------------------------------------------------------------------------------

export interface CreateCapableTransactionLike {
  create(ref: { id: string }, data: Record<string, unknown>): unknown;
}

/**
 * Writes the order and its position as a single atomic pair, using `transaction.create()`
 * (fail loud on collision) for BOTH — never `.set()`. Takes an ALREADY-OPEN transaction:
 * Firestore transactions cannot be nested, and this must run inside checkout's existing
 * capacity-and-duplicate-guarded `db.runTransaction(...)` callback, not open its own. See
 * README "Why writeReservationPair takes an already-open transaction, not its own".
 */
export function writeReservationPair(
  transaction: CreateCapableTransactionLike,
  refs: { orderRef: { id: string }; positionRef: { id: string } },
  docs: ReservationDocs
): void {
  transaction.create(refs.orderRef, docs.order);
  transaction.create(refs.positionRef, docs.position);
}

// ---------------------------------------------------------------------------------------------
// ticketing-multi-line-item-cart (F1) — additive N-line-item exports. See
// contracts/golden/ticketing-multi-line-item-cart/README.md for the full decision record.
// Every export above this point is UNCHANGED; nothing below repurposes it.
// ---------------------------------------------------------------------------------------------

export interface CheckoutLineItemInputLike {
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
  /** F5 (ticketing-f5-day-attendees) — null when the line item carries no chosen day. */
  chosenDay: string | null;
}

export interface LineItemPlan {
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
  /** Server-derived from Sanity per ticketType — never the request body. */
  amount: number;
  /** This position's OWN door code — distinct per line item, always. */
  bookingRef: string;
  /** F5 (ticketing-f5-day-attendees) — null when this line item carries no chosen day. */
  chosenDay: string | null;
}

/**
 * Pure. Sums requested quantity per ticket type across the whole cart — the step a naive
 * per-line-item loop skips, which is exactly how two line items of the same type both pass
 * an unaccumulated "1 more fits" check against a capacity of 1.
 */
export function aggregateRequestedQuantities(
  lineItems: { ticketType: string }[]
): Record<string, number> {
  const requestedQtyByType: Record<string, number> = {};
  for (const lineItem of lineItems) {
    requestedQtyByType[lineItem.ticketType] = (requestedQtyByType[lineItem.ticketType] ?? 0) + 1;
  }
  return requestedQtyByType;
}

/**
 * Pure. All-or-nothing capacity decision across every DISTINCT ticket type in the cart.
 * Returns EVERY offending type, not just the first, so the caller can report the whole
 * picture rather than a single opaque "something didn't fit".
 */
export function planCapacity(input: {
  requestedQtyByType: Record<string, number>;
  soldCountsByType: Record<string, number>;
  capacityByType: Record<string, number>;
}): { kind: 'ok' } | { kind: 'over-capacity'; ticketTypes: string[] } {
  const overCapacityTypes: string[] = [];
  for (const [ticketType, requestedQty] of Object.entries(input.requestedQtyByType)) {
    const alreadyHeld = input.soldCountsByType[ticketType] ?? 0;
    const capacity = input.capacityByType[ticketType] ?? 0;
    if (alreadyHeld + requestedQty > capacity) {
      overCapacityTypes.push(ticketType);
    }
  }
  return overCapacityTypes.length > 0
    ? { kind: 'over-capacity', ticketTypes: overCapacityTypes }
    : { kind: 'ok' };
}

/**
 * Pure. Order-independent multiset equality between a replayed request's line items and the
 * positions an idempotency key already produced. Both COUNT and CONTENT must match — a
 * first-item-only comparison (the literal, laziest port of today's `.limit(1)` duplicate
 * probe) is exactly the defect this exists to rule out.
 */
export function lineItemsMatchExistingPositions(
  requested: { ticketType: string; attendeeEmail: string; chosenDay: string | null }[],
  existing: { ticketType: string; attendeeEmail: string; chosenDay: string | null }[]
): boolean {
  if (requested.length !== existing.length) return false;

  const toKey = (item: {
    ticketType: string;
    attendeeEmail: string;
    chosenDay: string | null;
  }): string => `${item.ticketType}\u0000${item.attendeeEmail}\u0000${item.chosenDay ?? ''}`;

  const remainingByKey = new Map<string, number>();
  for (const item of existing) {
    const key = toKey(item);
    remainingByKey.set(key, (remainingByKey.get(key) ?? 0) + 1);
  }

  for (const item of requested) {
    const key = toKey(item);
    const remaining = remainingByKey.get(key) ?? 0;
    if (remaining === 0) return false;
    remainingByKey.set(key, remaining - 1);
  }

  // Lengths are equal and every requested item consumed one matching existing entry, so the
  // multisets are identical — no need to re-check leftover counts.
  return true;
}

export interface BuildMultiReservationDocsInput {
  orderId: string;
  /** Order-level payment reference. Decision: this is the FIRST line item's own
   *  `bookingRef` — see README "Why the order reference is the first line item's bookingRef,
   *  not a new identifier". */
  reference: string;
  showId: string;
  lineItems: LineItemPlan[];
  idempotencyKey: string;
  expiresAt: Timestamp;
  recoveryToken: string;
  recoveryTokenExpiresAt: Timestamp;
  now: Timestamp;
  /** F2 (ozow-payment-provider) — see BuildReservationDocsInput.gateway. THIS is the builder
   *  checkout/route.ts's reserveTicket() actually calls in production — fixing only the
   *  single-item sibling above would not have covered the live call path. */
  gateway: string;
  /** ozow-sandbox-toggle F1 — what we told the gateway to expect at initiate() time; `null`
   *  for PayFast or Ozow with the sandbox test-mode flag off. See
   *  contracts/golden/ozow-sandbox-toggle-f1/README.md §3b. */
  expectedGatewayAmount: number | null;
}

export interface MultiReservationDocs {
  order: Omit<Order, 'id'>;
  positions: (Omit<Ticket, 'id'> & { idempotencyKey: string })[];
}

/**
 * Builds the order body and every position body for a fresh multi-line-item checkout
 * reservation. Pure construction only — the caller writes all of them via
 * `writeMultiReservationPair()` inside its own already-open transaction.
 *
 * `order.amount` is the SUM of every line item's own amount, never a client-supplied total.
 * `order.buyerName`/`buyerEmail` come from `lineItems[0]` (see README "Buyer identity for a
 * multi-item order"). Every position's `m_payment_id` is the SHARED `input.reference`, not
 * that position's own bookingRef (see README "Why every position shares m_payment_id").
 */
export function buildMultiReservationDocs(
  input: BuildMultiReservationDocsInput
): MultiReservationDocs {
  const firstLineItem = input.lineItems[0];
  const totalAmount = input.lineItems.reduce((sum, lineItem) => sum + lineItem.amount, 0);

  const order: Omit<Order, 'id'> = {
    showId: input.showId,
    buyerName: firstLineItem.attendeeName,
    buyerEmail: firstLineItem.attendeeEmail,
    amount: totalAmount,
    status: 'reserved',
    expiresAt: input.expiresAt,
    idempotencyKey: input.idempotencyKey,
    purchasedAt: null,
    gateway: input.gateway,
    gatewayPaymentId: null,
    m_payment_id: input.reference,
    pf_payment_id: null,
    recoveryToken: input.recoveryToken,
    recoveryTokenExpiresAt: input.recoveryTokenExpiresAt,
    expectedGatewayAmount: input.expectedGatewayAmount,
  };

  const positions: (Omit<Ticket, 'id'> & { idempotencyKey: string })[] = input.lineItems.map(
    (lineItem) => ({
      bookingRef: lineItem.bookingRef,
      showId: input.showId,
      attendeeName: lineItem.attendeeName,
      attendeeEmail: lineItem.attendeeEmail,
      ticketType: lineItem.ticketType,
      status: 'reserved',
      amount: lineItem.amount,
      purchasedAt: null,
      checkedInAt: null,
      m_payment_id: input.reference,
      pf_payment_id: null,
      orderId: input.orderId,
      compedBy: null,
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      chosenDay: lineItem.chosenDay,
    })
  );

  return { order, positions };
}

/**
 * Same create()-and-fail-on-collision semantics as `writeReservationPair()`, reusing the
 * SAME `CreateCapableTransactionLike` interface — writes the order first, then every
 * position in `lineItems` order.
 */
export function writeMultiReservationPair(
  transaction: CreateCapableTransactionLike,
  refs: { orderRef: { id: string }; positionRefs: { id: string }[] },
  docs: MultiReservationDocs
): void {
  transaction.create(refs.orderRef, docs.order);
  docs.positions.forEach((position, index) => {
    transaction.create(refs.positionRefs[index], position);
  });
}

// ---------------------------------------------------------------------------------------------
// ticketing-f4-admission-products (F4) — additive pure exports. See
// contracts/golden/ticketing-f4-admission-products/README.md for the full decision record.
// Every export above this point is UNCHANGED; nothing below repurposes it.
// ---------------------------------------------------------------------------------------------

/**
 * Never exceeds `capacity` regardless of what `releasedQuantity` says — a released quantity
 * greater than physical capacity is a misconfiguration, not license to oversell. `0` is a
 * real, usable released quantity — NOT treated as "unset" via `||` (a released-quantity pool
 * that hasn't opened yet must return 0, never fall back to the full physical capacity).
 */
export function effectiveCapacity(
  capacity: number,
  releasedQuantity: number | null | undefined
): number {
  if (releasedQuantity === null || releasedQuantity === undefined) return capacity;
  return Math.min(capacity, releasedQuantity);
}

/**
 * `cutoffIso === null | undefined` => always true (no window restriction). Otherwise: true
 * through the END of the cutoff date (i.e. up to but not including the start of the day
 * after the cutoff date), not exact-millisecond comparison against midnight — a purchase
 * attempt made during the cutoff date itself must still succeed.
 */
export function isWithinEarlyBirdWindow(
  now: Date,
  cutoffIso: string | null | undefined
): boolean {
  if (cutoffIso === null || cutoffIso === undefined) return true;
  const cutoffEndExclusive = new Date(cutoffIso);
  cutoffEndExclusive.setUTCDate(cutoffEndExclusive.getUTCDate() + 1);
  return now.getTime() < cutoffEndExclusive.getTime();
}

/**
 * ticketing-flow-redesign (F1) — the sole source of price-selection logic for a ticket type
 * carrying an early-bird cutoff. See
 * contracts/golden/ticketing-flow-redesign-f1/pricing-model.golden.md for the full truth
 * table this must match.
 */
export function resolveEffectivePrice(input: {
  price: number;
  regularPrice: number | null;
  earlyBirdCutoff: string | null;
  now: Date;
}): number | null {
  if (!input.earlyBirdCutoff) return input.price;
  if (isWithinEarlyBirdWindow(input.now, input.earlyBirdCutoff)) return input.price;
  return input.regularPrice;
}

// ---------------------------------------------------------------------------------------------
// ticketing-f5-day-attendees (F5) — additive pure export. See
// contracts/golden/ticketing-f5-day-attendees/README.md for the full decision record.
// Every export above this point is UNCHANGED; nothing below repurposes it.
// ---------------------------------------------------------------------------------------------

/**
 * Pure, flag-driven (never slug-driven): true when `requiresAttendeeNames` is false (a name
 * is never required), or when it is true AND `attendeeName` has non-whitespace content.
 * Deliberately keyed on the boolean argument alone, never on a ticket-type slug string, so a
 * future second named-attendee product needs only a CMS flag, no code change.
 */
export function isNamedAttendeeSatisfied(
  requiresAttendeeNames: boolean,
  attendeeName: string
): boolean {
  if (!requiresAttendeeNames) return true;
  return attendeeName.trim().length > 0;
}

/**
 * Codex GPT-5.5 cross-model finding (2026-08-20), F5 gap 1. `chosenDay` is meaningful ONLY
 * for a ticket type with `requiresDaySelection: true` — strips it to null for every other
 * type rather than persisting whatever the request happened to attach. Silently ignoring
 * extra data, never rejecting it, matches this feature's existing permissive-on-extra-data
 * convention (README, "chosenDay: request shape, storage, and validation").
 */
export function resolveChosenDayForPosition(
  chosenDay: string | null | undefined,
  requiresDaySelection: boolean
): string | null {
  if (!requiresDaySelection) return null;
  return chosenDay ?? null;
}

/**
 * F3 (conference-workshop-tickets, M2) — pure decision: is this `chosenDay` excluded for a
 * ticket type carrying `excludedDays`? Same convention as `resolveChosenDayForPosition()`
 * above — a small pure helper so the decision is directly unit-testable without mocking a
 * Next.js request or a Sanity fetch. Returns `true` only when both a `chosenDay` and a
 * non-empty `excludedDays` are present AND `excludedDays` includes it; `false` whenever
 * `excludedDays` is null/undefined/empty (the "optional, defaults to no exclusion" invariant)
 * or `chosenDay` is null/undefined. See
 * .agent/memory/project/specs/conference-workshop-tickets/goldens/f2-sanity-schema-migration.golden.md
 * "Addendum".
 */
export function isChosenDayExcluded(
  chosenDay: string | null | undefined,
  excludedDays: string[] | null | undefined
): boolean {
  if (!chosenDay) return false;
  if (!excludedDays || excludedDays.length === 0) return false;
  return excludedDays.includes(chosenDay);
}

// ---------------------------------------------------------------------------------------------
// ticketing-conferences-and-events (F5, M2) — additive pure export. See
// goldens/f5-checkout.golden.md for the full decision record.
// Every export above this point is UNCHANGED; nothing below repurposes it.
// ---------------------------------------------------------------------------------------------

export interface CapacityPoolConfig {
  /** The shared pool this ticket type's sold units draw from. `null` => this ticketType is
   *  its own singleton pool — same as today's per-slug behavior. */
  pool: string | null;
  /** How many physical seats/heads one sold unit of this type consumes against its pool.
   *  Defaults to 1 when a type has no explicit config. */
  headcountPerUnit: number;
}

/**
 * Pure. Strict generalization of `planCapacity()` — pools capacity across ticket types that
 * share a `capacityPool`, weighting each requested/sold unit by its `headcountPerUnit`, rather
 * than checking each ticket type's slug independently. When `poolConfigByType` is empty (or
 * every entry resolves to `pool: null, headcountPerUnit: 1`), this produces byte-identical
 * results to `planCapacity()` on the same inputs.
 *
 * Resolves each entry's pool key as `poolConfigByType[slug]?.pool ?? slug` and its weight as
 * `poolConfigByType[slug]?.headcountPerUnit ?? 1`, sums weighted requested/sold quantities per
 * pool key, and rejects a pool where `soldHeads + requestedHeads > capacityByType[poolKey]`.
 * Returns every REQUESTED slug (not pool key) whose resolved pool is over capacity, preserving
 * `planCapacity()`'s "every offending type, not just the first" contract.
 */
export function planPooledCapacity(input: {
  requestedQtyByType: Record<string, number>;
  soldCountsByType: Record<string, number>;
  /** Keyed by resolved POOL KEY (poolConfigByType[slug]?.pool ?? slug), not always by slug. */
  capacityByType: Record<string, number>;
  poolConfigByType: Record<string, CapacityPoolConfig>;
}): { kind: 'ok' } | { kind: 'over-capacity'; ticketTypes: string[] } {
  const resolvePoolKey = (ticketType: string): string =>
    input.poolConfigByType[ticketType]?.pool ?? ticketType;
  const resolveWeight = (ticketType: string): number =>
    input.poolConfigByType[ticketType]?.headcountPerUnit ?? 1;

  const requestedHeadsByPool: Record<string, number> = {};
  for (const [ticketType, requestedQty] of Object.entries(input.requestedQtyByType)) {
    const poolKey = resolvePoolKey(ticketType);
    requestedHeadsByPool[poolKey] =
      (requestedHeadsByPool[poolKey] ?? 0) + requestedQty * resolveWeight(ticketType);
  }

  const soldHeadsByPool: Record<string, number> = {};
  for (const [ticketType, soldQty] of Object.entries(input.soldCountsByType)) {
    const poolKey = resolvePoolKey(ticketType);
    soldHeadsByPool[poolKey] =
      (soldHeadsByPool[poolKey] ?? 0) + soldQty * resolveWeight(ticketType);
  }

  const overCapacityTypes: string[] = [];
  for (const ticketType of Object.keys(input.requestedQtyByType)) {
    const poolKey = resolvePoolKey(ticketType);
    const soldHeads = soldHeadsByPool[poolKey] ?? 0;
    const requestedHeads = requestedHeadsByPool[poolKey] ?? 0;
    const capacity = input.capacityByType[poolKey] ?? 0;
    if (soldHeads + requestedHeads > capacity) {
      overCapacityTypes.push(ticketType);
    }
  }

  return overCapacityTypes.length > 0
    ? { kind: 'over-capacity', ticketTypes: overCapacityTypes }
    : { kind: 'ok' };
}

/**
 * F1 (conference-workshop-tickets, M1) — a GENERIC pool-remainder calculator for an
 * honest "N of X left" display. Deliberately named around a plain `poolSize`, not a
 * tranche-specific term, so the same function serves any such display. See
 * .agent/memory/project/specs/conference-workshop-tickets/goldens/f1-early-bird-remaining-cases.json
 * for the full fixture set this must match.
 *
 * Two real consumers wire this in elsewhere (neither built in this feature): F4's shared
 * 500-ticket admission early-bird pool (poolSize=500) and F6's per-event
 * conference-seats-remaining data (poolSize=80, one call per saoc-symposium/wosa-conference).
 * `soldCount` is always the caller's own real sold-plus-active-reserved count (e.g. the
 * result of `getSoldCountsByTicketType()`) — this function never queries anything itself.
 *
 * Pure: no `Date.now()`, no `await`, no Firestore/firebase-admin import, no network call.
 * `poolSize` of `null`/`undefined` passes through as `null` (no pool tracked for this
 * product — distinct from a pool that is merely sold out, which returns `0`). Never
 * returns a negative number.
 */
export function computeEarlyBirdRemaining(
  poolSize: number | null | undefined,
  soldCount: number,
): number | null {
  if (poolSize === null || poolSize === undefined) {
    return null;
  }
  return Math.max(poolSize - soldCount, 0);
}

// ---------------------------------------------------------------------------------------------
// conference-workshop-tickets (F4, M2) — additive exports for TRUE per-day capacity caps
// atop the UNMODIFIED planPooledCapacity() above. See
// .agent/memory/project/specs/conference-workshop-tickets/goldens/f4-capacity-pricing-engine.golden.md
// for the full decision record. Every export above this point is UNCHANGED; nothing below
// repurposes it.
// ---------------------------------------------------------------------------------------------

/**
 * Pure. Day-qualifies a pool key ONLY when `requiresDaySelection` is true — returns
 * `${poolKeyBase}::${chosenDay}` in that case, `poolKeyBase` left unchanged otherwise
 * (regardless of whether `chosenDay` is present at all). This is the ONE new thing the
 * checkout route needs to turn a single aggregate ceiling into independent per-day
 * counters — `planPooledCapacity()` itself is never modified, only the key shape fed
 * into it changes. See golden §2.
 */
export function resolveDayQualifiedPoolKey(
  poolKeyBase: string,
  chosenDay: string | null | undefined,
  requiresDaySelection: boolean
): string {
  if (!requiresDaySelection) return poolKeyBase;
  return `${poolKeyBase}::${chosenDay}`;
}

/**
 * Read-only, race-consistent remaining-count accessor for a scarcity display (golden §7).
 * Composes `resolveDayQualifiedPoolKey()` with the SAME two sold-count functions the
 * checkout transaction itself reads — never a third, independently-constructed query —
 * so the number a visitor sees can never diverge from the number the transaction
 * actually enforces. Called outside any transaction: a plain read, safe on every page
 * render.
 *
 * `deps` is an optional dependency-injection seam (same shape convention as
 * lib/confirmation-email.ts's SendConfirmationEmailDeps) so a fixture can inject stub
 * sold-count functions without a live Firestore read — no Firestore emulator exists on
 * this machine (see the golden's check-authoring addendum). Every real call site (F6's
 * loaders) omits `deps` entirely and gets the real, imported lib/data/tickets.ts
 * functions.
 */
export async function getPoolRemaining(
  args: {
    poolKeyBase: string;
    chosenDay?: string | null;
    requiresDaySelection: boolean;
    capacity: number;
    showId: string;
  },
  deps: {
    getSoldCountsByTicketTypeAndDay?: typeof getSoldCountsByTicketTypeAndDayReal;
    getSoldCountsByTicketType?: typeof getSoldCountsByTicketTypeReal;
  } = {}
): Promise<number> {
  // F4 round 3 (architect, 2026-10-07): day-visitor has NO unqualified pool at all
  // (golden §2) — its per-day cap is its ONLY ceiling. This combination names a pool
  // that does not exist, so it is a caller bug, not a zero-seats-left fact: fail loud
  // (coding.md "Fail fast") rather than silently surfacing a wrong aggregate-based
  // remaining count.
  if (args.poolKeyBase === DAY_VISITOR_DAY_CAP_POOL_KEY && args.requiresDaySelection === false) {
    throw new Error(
      "getPoolRemaining(): 'day-visitor' has no unqualified pool — call with requiresDaySelection: true and a chosenDay instead."
    );
  }

  // Fix (post-F4, Codex review): querying `new Set([args.poolKeyBase])` alone only
  // day-qualifies documents whose OWN ticketType is poolKeyBase (e.g. just
  // 'day-visitor') — an already-sold early-bird position for the same day would come
  // back under its own plain 'early-bird' key, never `day-visitor::<day>`, so it would
  // never be subtracted from this shared pool's remaining count. Every
  // DAY_VISITOR_SHAPED_SLUGS slug shares the one physical per-day pool (golden §2), so
  // every one of them must be day-qualified in the same query, matching the checkout
  // transaction's own dayCapPoolConfigByType construction in the route.
  const soldCountsByType = args.requiresDaySelection
    ? await (deps.getSoldCountsByTicketTypeAndDay ?? getSoldCountsByTicketTypeAndDayReal)(
        args.showId,
        new Set(DAY_VISITOR_SHAPED_SLUGS)
      )
    : await (deps.getSoldCountsByTicketType ?? getSoldCountsByTicketTypeReal)(args.showId);

  // Same reason as the query fix above: `getSoldCountsByTicketTypeAndDay()` returns one
  // key PER REAL TICKETTYPE SLUG (e.g. `day-visitor::2027-09-24` and
  // `early-bird::2027-09-24` as two separate entries), never pre-merged into a single
  // shared-pool key. `resolvedKey` alone would only ever read the slug matching
  // `args.poolKeyBase` — summing every DAY_VISITOR_SHAPED_SLUGS slug's day-qualified key
  // for this `chosenDay` is what actually reconstructs the shared pool's true sold
  // total. The unqualified branch needs no such sum: `getSoldCountsByTicketType()`
  // already returns one count per slug with no day-qualification to re-merge.
  //
  // Legacy carve-out (team-lead/QA, post-F4): `early-bird`'s `requiresDaySelection`
  // flipped false -> true in THIS mission's own M1 (commit cbac259c, 2026-10-07) — any
  // early-bird position reserved/paid before that deploy was written when the checkout
  // route never asked for a chosenDay at all, so it has no chosenDay field. Docs
  // §"Decision 2" (docs/f5-day-selection-attendees.md) already treats such a
  // pre-existing document as `chosenDay: null` for match purposes; the day cap must
  // treat it the same way rather than silently excluding it. `getSoldCountsByTicketTypeAndDay()`
  // keeps a day-qualified type's chosenDay-less document under its plain, unqualified
  // slug key (lib/data/tickets.ts's own doc comment) — since which day that seat was
  // actually for can never be recovered after the fact, it is counted conservatively
  // against EVERY day being checked, never dropped and never guessed onto just one day.
  const legacyNoChosenDayHeads = DAY_VISITOR_SHAPED_SLUGS.reduce(
    (total, slug) => total + (soldCountsByType[slug] ?? 0),
    0
  );
  const sold = args.requiresDaySelection
    ? DAY_VISITOR_SHAPED_SLUGS.reduce(
        (total, slug) =>
          total + (soldCountsByType[resolveDayQualifiedPoolKey(slug, args.chosenDay, true)] ?? 0),
        legacyNoChosenDayHeads
      )
    : sumUnqualifiedPoolSoldHeads(args.poolKeyBase, soldCountsByType);
  return Math.max(args.capacity - sold, 0);
}

/**
 * F4 round 4 (Codex, via gate A21; verified by team-lead, 2026-10-07): the UNQUALIFIED
 * branch above used to read `soldCountsByType[poolKeyBase]` directly — but
 * `getSoldCountsByTicketType()` keys its output by real ticketType SLUG
 * (lib/data/tickets.ts), never by pool key. For a shared pool like
 * `ADMISSION_EARLY_BIRD_POOL_KEY` ('admission-early-bird'), no document is EVER stored
 * with that literal as its `ticketType`, so the lookup was always 0 — the displayed "N
 * left" count never moved, and a pool sibling's sold units (e.g.
 * weekend-pass-early-bird's share of early-bird's pool) were never counted either way.
 *
 * Same membership/resolution semantics as `planPooledCapacity()`'s own
 * `resolvePoolKey`/`resolveWeight` (`poolConfigByType[ticketType]?.pool ?? ticketType`,
 * `?? 1`) and route.ts's live per-type construction — except sourced from
 * `lib/provisional-figures.ts`'s product arrays rather than a runtime `poolConfigByType`
 * map, since this read-only accessor takes no Sanity client and must not grow a third,
 * independently-constructed query. Reuses the SAME `[...ADMISSION_PRODUCTS,
 * ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS]` spread
 * scripts/seed-ticketing.ts and scripts/migrate-conference-workshop-tickets.ts already
 * use as the single source of every product's `capacityPool`/`headcountPerUnit` — no
 * second, hand-typed pool-membership list.
 */
function sumUnqualifiedPoolSoldHeads(
  poolKeyBase: string,
  soldCountsByType: Record<string, number>
): number {
  const allProducts = [...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS];
  let total = 0;
  for (const product of allProducts) {
    const resolvedPool = product.capacityPool ?? product.slug;
    if (resolvedPool !== poolKeyBase) continue;
    const weight = product.headcountPerUnit ?? 1;
    total += (soldCountsByType[product.slug] ?? 0) * weight;
  }
  return total;
}
