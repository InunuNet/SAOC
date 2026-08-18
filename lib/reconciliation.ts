import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { sendEmail, TICKETS_FROM_ADDRESS } from '@/lib/email';
import ReconciliationAlert from '@/emails/ReconciliationAlert';
import { ORDERS_COLLECTION } from '@/lib/orders';
import type { Order } from '@/types/index';

// Same local-const-per-file precedent lib/orders.ts and lib/checkin.ts already use for this
// collection name rather than exporting a shared constant.
const TICKETS_COLLECTION = 'tickets';

/**
 * order-reconciliation F1 — detects orders stranded `status == 'reserved'` past their
 * `expiresAt`, tracks an idempotent alert-bookkeeping timestamp, and sends a real email so a
 * human notices instead of depending on someone stumbling onto it (see
 * .agent/memory/project/specs/order-reconciliation/goldens/README.md).
 *
 * HARD BOUNDARY: this file never imports `markOrderAndPositionPaidByPaymentId` (the only
 * function in this codebase that can flip an order's `status` to `'paid'`) and never makes a
 * PayFast HTTP call. It flags stranded orders for a human; it never auto-settles one. See the
 * goldens README's "Recovery — deliberately NOT built in this contract" for the full reasoning.
 */

/** An order alerted within this window of `now` is excluded from needing a new alert, so
 *  back-to-back reconciliation runs (e.g. hourly) don't send one email per run for the same
 *  still-broken order. An order alerted once and never fixed surfaces again once the window
 *  elapses — this is a recurring reminder, not a permanent one-shot silence. */
export const RE_ALERT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

// ---------------------------------------------------------------------------------------------
// Deliberately narrow structural interfaces matching only the read/write surface this module
// actually calls, so the real `Firestore` class already satisfies them with zero adapter code
// — same injectable `deps.db` pattern lib/orders.ts's `OrdersFirestoreLike`/`OrdersFirestoreRwLike`
// already establish. This is what lets check-detects-stranded-orders.mjs (A2) prove the
// detection + re-alert filter logic against a fake, in-memory store without ever touching live
// Firestore.
// ---------------------------------------------------------------------------------------------

export interface ReconciliationDocSnapshotLike {
  readonly id: string;
  data(): Record<string, unknown> | undefined;
}

export interface ReconciliationQuerySnapshotLike {
  empty: boolean;
  docs: ReconciliationDocSnapshotLike[];
}

export interface ReconciliationQueryLike {
  where(field: string, op: '==' | '<', value: unknown): ReconciliationQueryLike;
  get(): Promise<ReconciliationQuerySnapshotLike>;
}

/** Just enough of a `DocumentReference` for `ReconciliationBatchLike.update` to key off — the
 *  real `DocumentReference` already has `id`, so this costs zero adapter code for the real
 *  client, same as `lib/orders.ts`'s `OrdersDocRefLike`. */
export interface ReconciliationDocRefLike {
  readonly id: string;
}

export interface ReconciliationCollectionLike {
  where(field: string, op: '==' | '<', value: unknown): ReconciliationQueryLike;
  doc(id: string): ReconciliationDocRefLike;
}

/** Just enough of a `WriteBatch` for `markOrdersAlerted`'s per-order atomic write — see that
 *  function's header for why a batch (not two independent updates) is required here. */
export interface ReconciliationBatchLike {
  update(ref: ReconciliationDocRefLike, data: Record<string, unknown>): unknown;
  commit(): Promise<unknown>;
}

export interface ReconciliationFirestoreLike {
  collection(name: string): ReconciliationCollectionLike;
  batch(): ReconciliationBatchLike;
}

function defaultDb(): ReconciliationFirestoreLike {
  return getFirestore(initAdmin()) as unknown as ReconciliationFirestoreLike;
}

/** A stranded order as returned by findStrandedOrders — the order's full stored fields plus
 *  its resolved Firestore document id under `orderId` (never `id`, to avoid colliding with any
 *  stray `id` field a fixture/order document happens to carry). */
export type StrandedOrder = Omit<Order, 'id'> & { orderId: string };

/**
 * Queries `orders` for `status == 'reserved' AND expiresAt < now` — necessary but not
 * sufficient on its own to prove "stranded": an abandoned mid-checkout cart also matches
 * `status == 'reserved'`, and `expiresAt < now` is exactly what excludes it (a live checkout's
 * `expiresAt` is still in the future). See check-detects-stranded-orders.mjs (A2) for the full
 * negative-control table this filter is proven against.
 *
 * `deps.db` — optional, defaults to the real `getFirestore(initAdmin())` when omitted, same
 * convention as `lib/orders.ts`'s `deps.db`.
 */
export async function findStrandedOrders(
  now: Timestamp,
  deps: { db?: ReconciliationFirestoreLike } = {}
): Promise<StrandedOrder[]> {
  const db = deps.db ?? defaultDb();
  const snapshot = await db
    .collection(ORDERS_COLLECTION)
    .where('status', '==', 'reserved')
    .where('expiresAt', '<', now)
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<Order, 'id'>),
    orderId: doc.id,
  }));
}

/**
 * Excludes any order alerted within RE_ALERT_WINDOW_MS of `now` — the idempotency guard that
 * stops back-to-back reconciliation runs from spamming one email per run for the same
 * still-broken order, while re-surfacing it once the window elapses (never a permanent
 * one-shot silence). Pure — takes and returns plain data, no Firestore access.
 */
export function filterOrdersNeedingAlert(
  orders: StrandedOrder[],
  now: Timestamp
): StrandedOrder[] {
  return orders.filter((order) => {
    const alertedAt = order.reconciliationAlertedAt;
    if (!alertedAt) return true;
    return now.toMillis() - alertedAt.toMillis() >= RE_ALERT_WINDOW_MS;
  });
}

/**
 * Writes ONLY `reconciliationAlertedAt` — on `orders/{orderId}` for every given order id, and
 * (ticketing-capacity-reconciliation-hold F1) on every `tickets/{id}` position whose `orderId`
 * matches — never `status`, `amount`, `gatewayPaymentId`, or `purchasedAt` on either
 * collection. The position write is what lets lib/data/tickets.ts's `stillHoldsSeat` (which
 * reads the `tickets` collection, not `orders`) keep holding a reconciliation-alerted seat past
 * its `expiresAt`; see check-live-detect-and-mark.mjs (A4) for the live proof that money-state
 * fields are left untouched across a real run.
 *
 * PER-ORDER ATOMICITY (added after Codex GPT-5.5 cross-model review flagged the original
 * two-independent-Promise.all version): the order's own stamp and every one of its positions'
 * stamps commit as a single `WriteBatch`, so either all of them land or none do. Without this,
 * a partial failure (order write succeeds, a position write throws) leaves
 * `orders/{orderId}.reconciliationAlertedAt` set — which suppresses re-alerting for
 * `RE_ALERT_WINDOW_MS` — while the position never got its matching stamp, so
 * `stillHoldsSeat` (lib/data/tickets.ts) releases that seat anyway: a paid-but-stranded buyer's
 * seat gets resold, and the alert that would have surfaced it is suppressed. Batching, not a
 * transaction, is deliberate here: the position query result is read once, up front, outside
 * the atomic unit (a position created between that read and the commit is a race the next
 * reconciliation run picks up, not a partial-write hazard); nothing inside the batch depends on
 * a read happening inside it.
 *
 * Failure is isolated PER ORDER, not across the whole call: each order gets its own batch,
 * committed in parallel via `Promise.all`, so one order's batch failing never blocks or
 * corrupts another's — every other order is independently re-alertable regardless.
 *
 * `deps.db` — optional, defaults to the real `getFirestore(initAdmin())` when omitted.
 */
export async function markOrdersAlerted(
  orderIds: string[],
  now: Timestamp,
  deps: { db?: ReconciliationFirestoreLike } = {}
): Promise<void> {
  if (orderIds.length === 0) return;
  const db = deps.db ?? defaultDb();
  const orders = db.collection(ORDERS_COLLECTION);
  const tickets = db.collection(TICKETS_COLLECTION);

  // Promise.allSettled, not Promise.all: with a bare Promise.all, a second (or third) order's
  // rejection is dropped the instant the first one rejects — Promise.all only ever surfaces one
  // reason, so a caller investigating "order X wasn't alerted" from the thrown message alone
  // could miss that order Y silently failed too. allSettled lets every order's batch run to
  // completion independently and collects every failure, so the aggregated error below is
  // never missing a failed order id.
  const results = await Promise.allSettled(
    orderIds.map(async (orderId) => {
      const positions = await tickets.where('orderId', '==', orderId).get();
      const batch = db.batch();
      batch.update(orders.doc(orderId), { reconciliationAlertedAt: now });
      for (const doc of positions.docs) {
        batch.update(tickets.doc(doc.id), { reconciliationAlertedAt: now });
      }
      await batch.commit();
    })
  );

  const failures = results
    .map((result, index) => ({ result, orderId: orderIds[index] }))
    .filter((entry): entry is { result: PromiseRejectedResult; orderId: string } =>
      entry.result.status === 'rejected'
    );

  if (failures.length === 0) return;

  // Surfaced, never swallowed: every order whose batch commit failed is named here, with its
  // own reason, so the caller (app/api/admin/reconcile-orders/route.ts) can log exactly which
  // orders still need re-alerting next run instead of a single opaque failure. Orders NOT
  // listed here committed successfully — their order doc and every one of their position docs
  // landed atomically.
  const detail = failures
    .map(({ orderId, result }) => `${orderId}: ${String(result.reason)}`)
    .join('; ');
  throw new Error(
    `markOrdersAlerted: ${failures.length}/${orderIds.length} order(s) failed to commit their ` +
      `reconciliationAlertedAt batch (order + position writes are all-or-nothing per order, so ` +
      `none of these failed orders' docs were partially written) — ${detail}`
  );
}

const DEFAULT_RECONCILIATION_ALERT_EMAIL = 'info@saoc.co.za';

function resolveReconciliationAlertEmail(): string {
  const raw = process.env.RECONCILIATION_ALERT_EMAIL?.trim();
  return raw ? raw : DEFAULT_RECONCILIATION_ALERT_EMAIL;
}

/**
 * Sends ONE real email listing every order that needs an alert. Reuses `lib/email.ts`'s
 * `sendEmail` (Resend) + `resolveReplyTo()` — this is the answer to "alerts go to a log nobody
 * reads": the alert is an email in a real inbox, not a `console.error` line.
 *
 * Propagates any send failure unchanged (never catches/swallows) — the caller
 * (app/api/admin/reconcile-orders/route.ts) relies on this to decide whether it's safe to call
 * markOrdersAlerted, so a send failure must never look like a success here.
 */
export async function sendReconciliationAlert(orders: StrandedOrder[]): Promise<void> {
  if (orders.length === 0) return;
  await sendEmail({
    to: resolveReconciliationAlertEmail(),
    subject: `${orders.length} stranded ticket order${orders.length === 1 ? '' : 's'} need review — SAOC`,
    react: ReconciliationAlert({
      orders: orders.map((order) => ({
        orderId: order.orderId,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        amount: order.amount,
        m_payment_id: order.m_payment_id,
      })),
    }),
    from: TICKETS_FROM_ADDRESS,
  });
}
