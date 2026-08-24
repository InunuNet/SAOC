import type { Timestamp } from 'firebase-admin/firestore';

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
