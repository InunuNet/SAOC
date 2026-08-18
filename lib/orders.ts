import { getFirestore, type Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { generateBookingRefQrDataUri } from '@/lib/qr';
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
  /** F8 (ticketing-foundation) — the issuing staff member's email for a comp position,
   *  threaded onto the written position as `compedBy: input.compedBy ?? null`. Additive:
   *  omitting it (every pre-F8 call shape) still compiles and still writes `null`. */
  compedBy?: string | null;
}

export interface CreateOrderPositionResult {
  orderId: string;
  ticketId: string;
}

// ---------------------------------------------------------------------------------------------
// F8 (ticketing-foundation) — deliberately narrow structural interfaces matching only the
// surface createOrderWithPosition() actually calls, so the real `Firestore`/`Transaction`
// classes from firebase-admin already satisfy them with zero adapter code. This is what makes
// A4's in-memory fake-store proof possible without ever touching live Firestore — see
// contracts/golden/ticketing-f8-comp-tickets/README.md.
// ---------------------------------------------------------------------------------------------

export interface OrdersDocRefLike {
  id: string;
}

export interface OrdersCollectionLike {
  doc(id?: string): OrdersDocRefLike;
}

export interface OrdersTransactionLike {
  set(ref: OrdersDocRefLike, data: Record<string, unknown>): unknown;
}

export interface OrdersFirestoreLike {
  collection(name: string): OrdersCollectionLike;
  runTransaction<T>(fn: (transaction: OrdersTransactionLike) => Promise<T> | T): Promise<T>;
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
 *
 * `deps.db` (F8) — optional, defaults to the real `getFirestore(initAdmin())` when omitted,
 * so every existing call shape (no second argument) keeps compiling and behaving identically.
 * Passing an `OrdersFirestoreLike`-shaped fake store is what lets F8's A4 prove the
 * order/position pair-write is genuinely atomic without ever touching live Firestore.
 */
export async function createOrderWithPosition(
  input: CreateOrderPositionInput,
  deps: { db?: OrdersFirestoreLike } = {}
): Promise<CreateOrderPositionResult> {
  const db: OrdersFirestoreLike = deps.db ?? getFirestore(initAdmin());
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
      compedBy: input.compedBy ?? null,
    };
    transaction.set(positionRef, position);
  });

  return { orderId, ticketId: positionRef.id };
}

// ---------------------------------------------------------------------------------------------
// F10 (ticketing-foundation) — the ITN update path: resolve an existing 'reserved' order/
// position pair by m_payment_id and flip both to 'paid' atomically. Deliberately SIBLING
// interfaces to the F8 ones above, not a widening of them — see
// contracts/golden/ticketing-f10-itn-repin/README.md "Why two interface families, not one
// widened one" for why OrdersTransactionLike/OrdersFirestoreLike/OrdersCollectionLike (F8,
// already shipped) are left untouched rather than extended in place.
// ---------------------------------------------------------------------------------------------

export interface OrdersDocSnapshotLike {
  readonly id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface OrdersQuerySnapshotLike {
  empty: boolean;
  docs: OrdersDocSnapshotLike[];
}

export interface OrdersLimitedQueryLike {
  get(): Promise<OrdersQuerySnapshotLike>;
}

export interface OrdersQueryLike {
  limit(n: number): OrdersLimitedQueryLike;
  get(): Promise<OrdersQuerySnapshotLike>;
}

export interface OrdersCollectionRwLike extends OrdersCollectionLike {
  where(field: string, op: '==', value: unknown): OrdersQueryLike;
}

export interface OrdersTransactionRwLike extends OrdersTransactionLike {
  get(ref: OrdersDocRefLike): Promise<OrdersDocSnapshotLike>;
  update(ref: OrdersDocRefLike, data: Record<string, unknown>): unknown;
}

export interface OrdersFirestoreRwLike {
  collection(name: string): OrdersCollectionRwLike;
  runTransaction<T>(fn: (transaction: OrdersTransactionRwLike) => Promise<T> | T): Promise<T>;
}

export type FindReservedOrderResult =
  | { status: 'not-found' }
  | { status: 'already-settled'; orderStatus: OrderStatus }
  | { status: 'reserved'; amount: number };

/**
 * Read-only, NOT transactional — an optimisation and amount-check path only, mirroring the
 * pre-F10 route's own initial ticket lookup. The authoritative status check and write happen
 * inside markOrderAndPositionPaidByPaymentId's own transaction below; this function's result
 * can be stale under concurrent ITN delivery and must never be relied on for the write
 * decision itself.
 */
export async function findReservedOrderByPaymentId(
  mPaymentId: string,
  deps: { db?: OrdersFirestoreRwLike } = {}
): Promise<FindReservedOrderResult> {
  const db: OrdersFirestoreRwLike = deps.db ?? (getFirestore(initAdmin()) as unknown as OrdersFirestoreRwLike);
  const orders = db.collection(ORDERS_COLLECTION);
  const snapshot = await orders.where('m_payment_id', '==', mPaymentId).limit(1).get();

  if (snapshot.empty) {
    return { status: 'not-found' };
  }

  const order = snapshot.docs[0].data() as Partial<Order> | undefined;
  const orderStatus = order?.status;
  if (orderStatus !== 'reserved') {
    return { status: 'already-settled', orderStatus: orderStatus as OrderStatus };
  }

  return { status: 'reserved', amount: Number(order?.amount) };
}

export type MarkOrderPaidOutcome =
  | {
      committed: true;
      orderId: string;
      buyerEmail: string;
      buyerName: string;
      recoveryToken: string | null;
      position: { bookingRef: string; attendeeName: string; ticketType: TicketType };
    }
  | { committed: false; reason: 'order-not-found' | 'order-not-reserved' | 'position-not-found' };

export interface MarkOrderAndPositionPaidInput {
  m_payment_id: string;
  gatewayPaymentId: string | null;
  now: Timestamp;
}

/**
 * Flips an existing 'reserved' order and its one child position to 'paid' together, inside a
 * single Firestore transaction. Order and position refs are resolved by query BEFORE the
 * transaction (ref-resolution only, mirroring the pre-F10 route's own pattern); the
 * authoritative re-read, idempotency check, and write all happen inside the transaction, so
 * whichever concurrent/duplicate delivery commits first wins and every other one observes the
 * now-'paid' order and no-ops. See the golden README's "Idempotency" section.
 *
 * `deps.db` — optional, defaults to the real `getFirestore(initAdmin())` when omitted, same
 * convention as `createOrderWithPosition`'s `deps.db` above.
 */
export async function markOrderAndPositionPaidByPaymentId(
  input: MarkOrderAndPositionPaidInput,
  deps: { db?: OrdersFirestoreRwLike } = {}
): Promise<MarkOrderPaidOutcome> {
  const db: OrdersFirestoreRwLike = deps.db ?? (getFirestore(initAdmin()) as unknown as OrdersFirestoreRwLike);
  const orders = db.collection(ORDERS_COLLECTION);
  const tickets = db.collection(TICKETS_COLLECTION);

  const orderSnapshot = await orders.where('m_payment_id', '==', input.m_payment_id).limit(1).get();
  if (orderSnapshot.empty) {
    return { committed: false, reason: 'order-not-found' };
  }
  const orderRef = orders.doc(orderSnapshot.docs[0].id);

  const positionSnapshot = await tickets.where('orderId', '==', orderRef.id).limit(1).get();

  return db.runTransaction(async (transaction) => {
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists) {
      return { committed: false, reason: 'order-not-found' };
    }
    const order = orderDoc.data() as Partial<Order> | undefined;
    if (order?.status !== 'reserved') {
      return { committed: false, reason: 'order-not-reserved' };
    }

    if (positionSnapshot.empty) {
      return { committed: false, reason: 'position-not-found' };
    }
    const positionRef = tickets.doc(positionSnapshot.docs[0].id);
    const positionDoc = await transaction.get(positionRef);
    if (!positionDoc.exists) {
      return { committed: false, reason: 'position-not-found' };
    }
    const position = positionDoc.data() as Partial<Ticket> | undefined;

    transaction.update(orderRef, {
      status: 'paid',
      gatewayPaymentId: input.gatewayPaymentId,
      purchasedAt: input.now,
    });
    transaction.update(positionRef, {
      status: 'paid',
      purchasedAt: input.now,
    });

    return {
      committed: true,
      orderId: orderRef.id,
      buyerEmail: order?.buyerEmail ?? '',
      buyerName: order?.buyerName ?? '',
      recoveryToken: (order?.recoveryToken as string | null | undefined) ?? null,
      position: {
        bookingRef: (position?.bookingRef as string | undefined) ?? positionRef.id,
        attendeeName: (position?.attendeeName as string | undefined) ?? '',
        ticketType: position?.ticketType as TicketType,
      },
    };
  });
}

// ---------------------------------------------------------------------------------------------
// F1 (confirmation-page-qr-and-download) — server-only read used by the confirmation page to
// render a real, scannable QR and buyer details straight into HTML. Deliberately NOT exposed
// through app/api/tickets/status/route.ts: that route stays { status }-only forever (see this
// feature's golden "The hard security constraint"), so this function is only ever called from a
// Server Component, never imported into a 'use client' file.
// ---------------------------------------------------------------------------------------------

/** Mirrors the confirmation page's existing CONFIRMED_STATUSES set — a 'reserved' position
 *  yields null here, same as an absent one, so the page falls back to the poller. */
const CONFIRMED_TICKET_STATUSES = new Set<TicketStatus>(['paid', 'checked-in']);

export interface ConfirmedTicketDisplay {
  bookingRef: string;
  attendeeName: string;
  ticketType: TicketType;
  amount: number;
  qrDataUri: string;
}

/**
 * Looks up `tickets/{bookingRef}` directly (the position's document id IS the booking ref, same
 * convention as `createOrderWithPosition` and `lib/checkin.ts`) and returns the fields the
 * confirmation page needs to render, plus a freshly generated QR data URI.
 *
 * Fail-closed: returns `null` — never a partial object, never a thrown error for a merely
 * unconfirmed or absent ticket — unless the document exists AND its status is 'paid' or
 * 'checked-in'.
 */
export async function getConfirmedTicketForDisplay(
  bookingRef: string
): Promise<ConfirmedTicketDisplay | null> {
  if (bookingRef.trim().length === 0) {
    return null;
  }

  const db = getFirestore(initAdmin());
  const snapshot = await db.collection(TICKETS_COLLECTION).doc(bookingRef).get();
  if (!snapshot.exists) {
    return null;
  }

  const position = snapshot.data() as Partial<Ticket> | undefined;
  const status = position?.status;
  if (!status || !CONFIRMED_TICKET_STATUSES.has(status)) {
    return null;
  }

  const attendeeName = position?.attendeeName;
  const ticketType = position?.ticketType;
  const amount = position?.amount;
  if (!attendeeName || !ticketType || typeof amount !== 'number') {
    return null;
  }

  return {
    bookingRef,
    attendeeName,
    ticketType,
    amount,
    qrDataUri: await generateBookingRefQrDataUri(bookingRef),
  };
}
