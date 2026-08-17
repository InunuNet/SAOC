import { getFirestore, type Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import type { Order, OrderStatus, Ticket, TicketStatus, TicketType } from '@/types/index';

/**
 * F2 (ticketing-foundation) — orders/positions creation primitive (§4.2-§4.4).
 *
 * `orders` sits between `show` and `tickets` (positions). This module is the shared
 * creation primitive later features (F8 comp tickets, F10 checkout/ITN rewrite) build
 * on; it does not itself rewire checkout or the ITN route — see
 * contracts/golden/ticketing-f2-orders-model/README.md "Scope boundary".
 */

export const ORDERS_COLLECTION = 'orders';

const TICKETS_COLLECTION = 'tickets';

export interface CreateOrderPositionInput {
  /** Omit to auto-generate a Firestore id (real purchases). Callers supply a fixed id only
   *  for deliberately idempotent fixture writes (contract checks) — see the golden
   *  README's "Fixture lifecycle". */
  orderId?: string;
  /** The position's document id, same convention as checkout's existing
   *  `tickets.doc(bookingRef)` — always caller-supplied, never auto-generated, so the
   *  booking reference and the Firestore doc id are always the same value. */
  bookingRef: string;
  showId: string;
  buyerName: string;
  buyerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketType: TicketType;
  amount: number;
  orderStatus: OrderStatus;
  positionStatus: TicketStatus;
  idempotencyKey: string;
  expiresAt: Timestamp | null;
  /** Caller-supplied, not defaulted to null: F8's comp route and F10's ITN two-write both
   *  need to set a real purchase timestamp at creation time in some call shapes (a comp is
   *  'paid' the instant it's created), so this primitive doesn't assume "always null at
   *  creation" the way checkout's current flat write does. */
  purchasedAt: Timestamp | null;
  gateway: string | null;
  gatewayPaymentId: string | null;
  m_payment_id: string | null;
  pf_payment_id: string | null;
}

export interface CreateOrderPositionResult {
  orderId: string;
  ticketId: string;
}

/**
 * Writes one `orders/{orderId}` document and one `tickets/{bookingRef}` document — the
 * position — inside a single transaction, with the position's `orderId` set to the
 * order's resolved id.
 *
 * Uses `transaction.set()` (idempotent upsert), NOT `transaction.create()` — deliberately
 * different from checkout's existing `tickets.doc(bookingRef)` create-and-fail-on-collision
 * semantics, because this function is also the deliberately-idempotent fixture-creation
 * path contract checks reuse across repeated runs (see the golden README's "Fixture
 * lifecycle"). Real callers (F8's comp route, F10's checkout rewrite) always pass a fresh,
 * cryptographically random bookingRef from `generateBookingRef()`, so idempotent-by-id
 * semantics never mask a real collision in production use — a collision there would
 * require `generateBookingRef()` itself to repeat, which is the same ~60-bit-entropy
 * assumption checkout already relies on today.
 *
 * Additive-only on the position (see the golden README's "Field-move decision, revised"):
 * `amount`/`purchasedAt`/`m_payment_id`/`pf_payment_id` are duplicated onto BOTH the order
 * and the position so every live `Ticket`-typed consumer keeps working unmodified until
 * F10's backfill makes the order the sole source of truth. `gateway`/`gatewayPaymentId`
 * are genuinely new, order-only concepts and are NOT duplicated onto the position.
 */
export async function createOrderWithPosition(
  input: CreateOrderPositionInput
): Promise<CreateOrderPositionResult> {
  const db = getFirestore(initAdmin());
  const orders = db.collection(ORDERS_COLLECTION);
  const tickets = db.collection(TICKETS_COLLECTION);

  const orderRef = input.orderId ? orders.doc(input.orderId) : orders.doc();
  const orderId = orderRef.id;
  const positionRef = tickets.doc(input.bookingRef);

  await db.runTransaction(async (transaction) => {
    const order: Omit<Order, 'id'> = {
      showId: input.showId,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      amount: input.amount,
      status: input.orderStatus,
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      purchasedAt: input.purchasedAt,
      gateway: input.gateway,
      gatewayPaymentId: input.gatewayPaymentId,
      m_payment_id: input.m_payment_id,
      pf_payment_id: input.pf_payment_id,
    };
    transaction.set(orderRef, order);

    const position: Omit<Ticket, 'id'> = {
      bookingRef: input.bookingRef,
      showId: input.showId,
      attendeeName: input.attendeeName,
      attendeeEmail: input.attendeeEmail,
      ticketType: input.ticketType,
      status: input.positionStatus,
      amount: input.amount,
      purchasedAt: input.purchasedAt,
      checkedInAt: null,
      m_payment_id: input.m_payment_id,
      pf_payment_id: input.pf_payment_id,
      orderId,
    };
    transaction.set(positionRef, position);
  });

  return { orderId, ticketId: positionRef.id };
}
