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
