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

/** The sole gateway checkout ever writes — distinguishes a real PayFast order from a comp
 *  order (lib/comp-tickets.ts's `COMP_GATEWAY`) on reconciliation. */
export const PAYFAST_GATEWAY = 'payfast';

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
    gateway: PAYFAST_GATEWAY,
    gatewayPaymentId: null,
    m_payment_id: input.bookingRef,
    pf_payment_id: null,
    recoveryToken: input.recoveryToken,
    recoveryTokenExpiresAt: input.recoveryTokenExpiresAt,
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
}

export interface LineItemPlan {
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
  /** Server-derived from Sanity per ticketType — never the request body. */
  amount: number;
  /** This position's OWN door code — distinct per line item, always. */
  bookingRef: string;
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
  requested: { ticketType: string; attendeeEmail: string }[],
  existing: { ticketType: string; attendeeEmail: string }[]
): boolean {
  if (requested.length !== existing.length) return false;

  const toKey = (item: { ticketType: string; attendeeEmail: string }): string =>
    `${item.ticketType}\u0000${item.attendeeEmail}`;

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
    gateway: PAYFAST_GATEWAY,
    gatewayPaymentId: null,
    m_payment_id: input.reference,
    pf_payment_id: null,
    recoveryToken: input.recoveryToken,
    recoveryTokenExpiresAt: input.recoveryTokenExpiresAt,
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
