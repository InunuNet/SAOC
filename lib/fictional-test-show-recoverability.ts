// Fictional Test Show — the three-hop cleanup-report join logic that
// scripts/report-fictional-test-show-artifacts.ts calls after doing its own real Firestore
// reads. Pure classification only — no Firestore/Sanity client import, no I/O, no
// Date.now(). See contracts/golden/fictional-test-show/README.md "The recoverability chain,
// three hops" for why each hop is shaped the way it is, read directly from the code:
// Firestore positions never carry a marker boolean (the sole channel is
// isFictionalTestShowTicketTypeSlug() against `ticketType`), `Order` has no `ticketType`
// field at all (the join is `position.orderId` -> `order.id`), and `CheckinAttemptRecord`
// carries neither a `ticketType` nor a marker boolean (the join is dual: `bookingRef` OR
// `orderId`, because a malformed/mis-scanned attempt can carry one without the other).

import { isFictionalTestShowTicketTypeSlug } from './fictional-test-show';

export interface RecoverablePosition {
  bookingRef: string;
  ticketType: string | null;
  orderId: string | null;
}

export interface RecoverableOrder {
  id: string;
}

export interface RecoverableCheckinAttempt {
  bookingRef: string | null;
  orderId: string | null;
}

export interface FictionalTestShowArtifactReport {
  positions: RecoverablePosition[];
  orders: RecoverableOrder[];
  checkinAttempts: RecoverableCheckinAttempt[];
}

/**
 * Walks the three-hop chain: (a) positions matched by ticket-type slug; (b) orders matched by
 * appearing as a matched position's `orderId`; (c) checkin attempts matched by `bookingRef`
 * OR `orderId` against the matched positions/orders above.
 */
export function classifyFictionalTestShowArtifacts(input: {
  positions: RecoverablePosition[];
  orders: RecoverableOrder[];
  checkinAttempts: RecoverableCheckinAttempt[];
}): FictionalTestShowArtifactReport {
  const positions = input.positions.filter((p) => isFictionalTestShowTicketTypeSlug(p.ticketType));

  const matchedOrderIds = new Set(
    positions.map((p) => p.orderId).filter((orderId): orderId is string => orderId !== null)
  );
  const orders = input.orders.filter((o) => matchedOrderIds.has(o.id));

  const matchedBookingRefs = new Set(positions.map((p) => p.bookingRef));
  const matchedOrderIdsFromOrders = new Set(orders.map((o) => o.id));
  const checkinAttempts = input.checkinAttempts.filter(
    (c) =>
      (c.bookingRef !== null && matchedBookingRefs.has(c.bookingRef)) ||
      (c.orderId !== null && matchedOrderIdsFromOrders.has(c.orderId))
  );

  return { positions, orders, checkinAttempts };
}
