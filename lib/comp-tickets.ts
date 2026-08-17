import { Timestamp } from 'firebase-admin/firestore';

import type { CreateOrderPositionInput } from '@/lib/orders';
import type { TicketType } from '@/types/index';

/**
 * F8 (ticketing-foundation) — comp-ticket construction primitive (spec §4.5). Pure
 * construction only: no Firestore, no network, no `Date.now()`/`new Date()` — `now` is
 * always the caller-supplied value (A6 proves this behaviourally). See
 * contracts/golden/ticketing-f8-comp-tickets/README.md for the full decision record,
 * including why `gateway: 'comp'` is the sole safe reconciliation discriminator and why
 * `buyerName`/`buyerEmail` are the attendee's own rather than an invented placeholder.
 */

/** The ONLY safe field a reconciliation script may rely on to exclude comps from revenue
 *  — never `amount === 0` alone, since a future genuinely-free real ticket tier would also
 *  be `amount === 0` without being a comp. See the golden README's "Comp amount/payment-
 *  field decision". */
export const COMP_GATEWAY = 'comp';

export interface BuildCompOrderInput {
  showId: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketType: TicketType;
  /** The issuing staff member's email — recorded verbatim as `compedBy` (A6). */
  issuedByEmail: string;
  /** Caller-generated via the existing `generateBookingRef()` (lib/booking-ref.ts) — never
   *  minted inside this pure module. */
  bookingRef: string;
  /** Omit to auto-generate a Firestore id (real comps). */
  orderId?: string;
  /** Injected, never read from wall-clock time internally (A6). */
  now: Date;
}

export type CompOrderPositionInput = CreateOrderPositionInput & { compedBy: string };

/**
 * Builds the order/position construction input for a comp ticket — free, PayFast-
 * bypassing, and unambiguously distinguishable from a paid order on reconciliation (A5).
 * The caller passes the result straight to `createOrderWithPosition()`
 * (lib/orders.ts) to write the atomic order/position pair.
 */
export function buildCompOrderInput(input: BuildCompOrderInput): CompOrderPositionInput {
  return {
    orderId: input.orderId,
    bookingRef: input.bookingRef,
    showId: input.showId,
    buyerName: input.attendeeName,
    buyerEmail: input.attendeeEmail,
    attendeeName: input.attendeeName,
    attendeeEmail: input.attendeeEmail,
    ticketType: input.ticketType,
    amount: 0,
    orderStatus: 'paid',
    positionStatus: 'paid',
    idempotencyKey: `comp:${input.bookingRef}`,
    expiresAt: null,
    purchasedAt: Timestamp.fromDate(input.now),
    gateway: COMP_GATEWAY,
    gatewayPaymentId: null,
    m_payment_id: null,
    pf_payment_id: null,
    compedBy: input.issuedByEmail,
  };
}
