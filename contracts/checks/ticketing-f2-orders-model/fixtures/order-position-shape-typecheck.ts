// F2 (ticketing-foundation) — behavioural (compiler-driven) proof of the order/position
// field shape, run via the same scoped tsconfig as ticket-status-typecheck.ts (see that
// file's header for why this needs its own `npx tsc -p` invocation rather than
// `pnpm type-check`).
//
// REVISED 2026-08-17: F2 is purely ADDITIVE to `Ticket`, not a field move. The first draft
// of this fixture asserted (via `@ts-expect-error`) that `amount`/`purchasedAt`/
// `m_payment_id`/`pf_payment_id` no longer exist on `Ticket` — that was wrong. Two live
// consumers construct object literals contextually typed as `Ticket[]` and include all
// four fields today: `app/admin/page.tsx`'s `fetchTickets()` and
// `app/api/admin/tickets/route.ts`'s `GET` handler (both read the `tickets` collection
// directly and shape every document into a full `Ticket`, including `amount` for the CSV/
// dashboard export). Dropping the fields from the type would fail excess-property checking
// on those two literals the moment `pnpm type-check` (A1) ran — a real compile break, not
// a hypothetical one. Removing them also does not ship until F10, when checkout/ITN stop
// writing them onto positions and a backfill runs — until then every live document still
// physically carries them, so a `Ticket` type that hides them would describe data that
// does not match what's on disk. See golden/README.md "Field-move decision, revised" for
// the full reasoning.
//
// Two things are proved here, both by assignability, not by grepping type text:
//
// 1. `Ticket` (the position) GAINS `orderId: string | null`, on top of every field it
//    already had (bookingRef, showId, attendeeName, attendeeEmail, ticketType, status,
//    amount, purchasedAt, checkedInAt, m_payment_id, pf_payment_id) — all of which stay,
//    unchanged, positively asserted below (no `@ts-expect-error` on any of them).
//
// 2. `Order` exists with the full §4.2/§4.4 field set, `status` restricted to
//    `OrderStatus` (`'reserved' | 'paid' | 'cancelled'` — NOT `TicketStatus`; an order is
//    never itself "checked-in" or "refunded", only its positions are), and a value outside
//    that three-member set is rejected.

import type { Order, OrderStatus, Ticket } from '../../../../types/index';

// --- Ticket (position): orderId is new, nullable ---
declare const ticket: Ticket;
const orderId: string | null = ticket.orderId;
void orderId;

// --- Ticket (position): every pre-existing field, including the four payment-facing
// ones, stays exactly as it was — positively asserted, not @ts-expect-error'd away.
// (`declare` is for the ambient `ticket`/`order` values above only — a `declare`d
// binding cannot itself carry an initializer, so these are plain `const`s.)
const _bookingRef: string = ticket.bookingRef;
const _showId: string = ticket.showId;
const _attendeeName: string = ticket.attendeeName;
const _attendeeEmail: string = ticket.attendeeEmail;
const _ticketType: string = ticket.ticketType;
const _status: Ticket['status'] = ticket.status;
const _amount: number = ticket.amount;
const _purchasedAt: Ticket['purchasedAt'] = ticket.purchasedAt;
const _checkedInAt: Ticket['checkedInAt'] = ticket.checkedInAt;
const _mPaymentId: string | null = ticket.m_payment_id;
const _pfPaymentId: string | null = ticket.pf_payment_id;
void [
  _bookingRef,
  _showId,
  _attendeeName,
  _attendeeEmail,
  _ticketType,
  _status,
  _amount,
  _purchasedAt,
  _checkedInAt,
  _mPaymentId,
  _pfPaymentId,
];

// --- Order: full field set from §4.2/§4.4 ---
declare const order: Order;
const _orderShowId: string = order.showId;
const _orderBuyerName: string = order.buyerName;
const _orderBuyerEmail: string = order.buyerEmail;
const _orderAmount: number = order.amount;
const _orderStatus: OrderStatus = order.status;
const _orderExpiresAt: Order['expiresAt'] = order.expiresAt;
const _orderIdempotencyKey: string = order.idempotencyKey;
const _orderPurchasedAt: Order['purchasedAt'] = order.purchasedAt;
const _orderGateway: string | null = order.gateway;
const _orderGatewayPaymentId: string | null = order.gatewayPaymentId;
const _orderMPaymentId: string | null = order.m_payment_id;
const _orderPfPaymentId: string | null = order.pf_payment_id;
void [
  _orderShowId,
  _orderBuyerName,
  _orderBuyerEmail,
  _orderAmount,
  _orderStatus,
  _orderExpiresAt,
  _orderIdempotencyKey,
  _orderPurchasedAt,
  _orderGateway,
  _orderGatewayPaymentId,
  _orderMPaymentId,
  _orderPfPaymentId,
];

// --- Order.status is OrderStatus (3 members), never TicketStatus's 5 ---
const reserved: OrderStatus = 'reserved';
const paid: OrderStatus = 'paid';
const cancelled: OrderStatus = 'cancelled';
void [reserved, paid, cancelled];

// @ts-expect-error — 'checked-in' is a TicketStatus (position) value, never a valid Order
// status. An order is not itself scanned at the door.
const invalidCheckedIn: OrderStatus = 'checked-in';
// @ts-expect-error — 'refunded' is a TicketStatus (position) value. Refunds target one
// position (§4.3), never the whole order — see spec §4.2/§4.3.
const invalidRefunded: OrderStatus = 'refunded';
void [invalidCheckedIn, invalidRefunded];
