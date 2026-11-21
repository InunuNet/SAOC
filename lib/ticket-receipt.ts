import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { sendConfirmationEmail } from '@/lib/confirmation-email';
import type { ConfirmationEmailPosition } from '@/lib/confirmation-email';
import { initAdmin } from '@/lib/firebase-admin';
import { ORDERS_COLLECTION } from '@/lib/orders';
import { isMissingIndexError } from '@/lib/reconciliation';
import { logFailureSafely, safeErrorType } from '@/lib/safe-log';
import { buildOrderEmailFields } from '@/lib/ticket-order-fields';
import { loadChosenDays } from '@/lib/ticket-pdf-data';
import type { Order } from '@/types/index';

/**
 * The buyer's receipt email after payment: one function that sends it (used by the payment
 * notification handler and by the reconcile retry, so both send the very same email), the
 * delivery record written onto the order, and the bounded retry of failed deliveries.
 *
 * `orders/{id}.receiptEmail = { status: 'sent' | 'failed', attempts, lastAttemptAt,
 * lastErrorType }`, the same shape of record app/api/contact/route.ts keeps as `emailDelivery`.
 * Only a built-in error type name is stored (safeErrorType), never the raw error.
 */

const TICKETS_COLLECTION = 'tickets';

/** Attempts in total, the first (in the notification handler) included. */
export const RECEIPT_MAX_ATTEMPTS = 3;
/** Only receipts for orders paid within this window are retried. */
export const RECEIPT_RETRY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** At most this many receipts are re-sent per reconcile run. */
export const RECEIPT_RETRY_BATCH_LIMIT = 20;
/** Failed-receipt documents read per run; the attempts cap is applied in memory. */
export const RECEIPT_RETRY_SCAN_LIMIT = 100;
/** The retry stops starting new sends once it has run this long; the rest wait for the next run. */
export const RECEIPT_RETRY_TIME_BUDGET_MS = 20 * 1000;
/** A retry claim also stamps lastAttemptAt; an order attempted more recently than this is left
 *  alone, which is what stops two overlapping reconcile runs from both re-sending. */
export const RECEIPT_RETRY_MIN_INTERVAL_MS = 10 * 60 * 1000;

export interface ReceiptOrderFacts {
  orderId: string;
  /** The order reference (`m_payment_id`). */
  reference: string;
  buyerEmail: string;
  buyerName: string;
  recoveryToken: string | null;
  /** The order total in rand, as stored on the order. */
  amount: number;
  positions: (ConfirmationEmailPosition & { chosenDay?: string | null })[];
}

/** Sends the receipt. Throws on failure: the caller decides how to record it. */
export async function sendOrderReceipt(facts: ReceiptOrderFacts): Promise<void> {
  // Per-ticket-type email facts (used only once TICKET_TYPE_EMAILS_LIVE is on): the stored order
  // price, and the buyer's chosen day read back from the paid order (never throws).
  const chosenDays = await loadChosenDays(facts.reference);
  const firstChosenDay = chosenDays.get(facts.positions[0]?.bookingRef) ?? null;
  await sendConfirmationEmail({
    orderId: facts.orderId,
    buyerEmail: facts.buyerEmail,
    buyerName: facts.buyerName,
    recoveryToken: facts.recoveryToken,
    orderReference: facts.reference,
    positions: facts.positions,
    ...buildOrderEmailFields(facts.amount, firstChosenDay),
    // One stable key per order, on the first send and on every retry: if a delivered receipt's
    // 'sent' write is lost, the re-send is recognised by the mailer instead of reaching the buyer.
    idempotencyKey: `receipt-${facts.orderId}`,
  });
}

// ---------------------------------------------------------------------------------------------
// Narrow structural Firestore surface, injectable like lib/reconciliation.ts's `deps.db`.
// ---------------------------------------------------------------------------------------------

export interface ReceiptDocRefLike {
  readonly id: string;
  update(data: Record<string, unknown>): Promise<unknown>;
}

export interface ReceiptDocSnapshotLike {
  readonly id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface ReceiptQueryLike {
  where(field: string, op: '==' | '>', value: unknown): ReceiptQueryLike;
  orderBy(field: string, direction: 'asc' | 'desc'): ReceiptQueryLike;
  limit(count: number): ReceiptQueryLike;
  get(): Promise<{ docs: ReceiptDocSnapshotLike[] }>;
}

export interface ReceiptTransactionLike {
  get(ref: ReceiptDocRefLike): Promise<ReceiptDocSnapshotLike>;
  update(ref: ReceiptDocRefLike, data: Record<string, unknown>): unknown;
}

export interface ReceiptFirestoreLike {
  collection(name: string): ReceiptQueryLike & { doc(id: string): ReceiptDocRefLike };
  runTransaction<T>(fn: (transaction: ReceiptTransactionLike) => Promise<T>): Promise<T>;
}

function defaultDb(): ReceiptFirestoreLike {
  return getFirestore(initAdmin()) as unknown as ReceiptFirestoreLike;
}

type ReceiptRecord = NonNullable<Order['receiptEmail']>;

function receiptRecord(
  attempts: number,
  now: Timestamp,
  error: unknown,
  failed: boolean
): ReceiptRecord {
  return {
    status: failed ? 'failed' : 'sent',
    attempts,
    lastAttemptAt: now,
    lastErrorType: failed ? safeErrorType(error) : null,
  };
}

/**
 * Records the outcome of the first receipt attempt (made by the notification handler). Never
 * throws: the payment is already committed, and a failed bookkeeping write must not turn into a
 * failed notification. `error` undefined means the send succeeded.
 */
export async function recordFirstReceiptAttempt(
  input: { orderId: string; now: Timestamp; failed: boolean; error?: unknown },
  deps: { db?: ReceiptFirestoreLike } = {}
): Promise<void> {
  try {
    const db = deps.db ?? defaultDb();
    await db
      .collection(ORDERS_COLLECTION)
      .doc(input.orderId)
      .update({ receiptEmail: receiptRecord(1, input.now, input.error, input.failed) });
  } catch (writeError) {
    logFailureSafely('[ticket-receipt] could not record receipt delivery status', writeError);
  }
}

export interface ReceiptRetrySummary {
  /** Failed-receipt orders read this run. */
  scanned: number;
  /** Receipts re-sent successfully and marked sent. */
  resent: number;
  /** Retries attempted that failed again. */
  stillFailing: number;
  /** Candidates left unstarted because the time budget ran out; the next run picks them up. */
  deferred: number;
  /** Set when the composite index for the query is missing; the retry step was skipped. */
  skipped: 'missing-index' | null;
}

function millis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

/** Candidates are failed receipts of paid orders, newest first, still under the attempts cap. */
async function findFailedReceiptOrders(
  db: ReceiptFirestoreLike,
  now: Timestamp
): Promise<ReceiptDocSnapshotLike[]> {
  const windowStart = Timestamp.fromMillis(now.toMillis() - RECEIPT_RETRY_LOOKBACK_MS);
  const snapshot = await db
    .collection(ORDERS_COLLECTION)
    .where('receiptEmail.status', '==', 'failed')
    .where('purchasedAt', '>', windowStart)
    .orderBy('purchasedAt', 'desc')
    .limit(RECEIPT_RETRY_SCAN_LIMIT)
    .get();
  return snapshot.docs
    .filter((doc) => {
      const data = doc.data();
      const attempts = (data?.['receiptEmail'] as Partial<ReceiptRecord> | undefined)?.attempts;
      return data?.['status'] === 'paid' && typeof attempts === 'number' && attempts < RECEIPT_MAX_ATTEMPTS;
    })
    .slice(0, RECEIPT_RETRY_BATCH_LIMIT);
}

/**
 * Takes the retry for one order inside a transaction: re-checks it is still a paid order whose
 * receipt is 'failed', under the cap and not attempted within the minimum interval, then records
 * the attempt (attempts + 1, lastAttemptAt) BEFORE anything is sent. A 'sent' order, a concurrent
 * run's claim, or a capped order all return null, so nothing is ever sent twice.
 */
async function claimRetry(
  db: ReceiptFirestoreLike,
  orderId: string,
  now: Timestamp
): Promise<{ order: Record<string, unknown>; record: ReceiptRecord } | null> {
  const ref = db.collection(ORDERS_COLLECTION).doc(orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const order = snapshot.exists ? snapshot.data() : undefined;
    const record = order?.['receiptEmail'] as Partial<ReceiptRecord> | undefined;
    if (!order || order['status'] !== 'paid' || record?.status !== 'failed') return null;
    if (typeof record.attempts !== 'number' || record.attempts >= RECEIPT_MAX_ATTEMPTS) return null;
    const lastAttempt = millis(record.lastAttemptAt);
    if (lastAttempt !== null && now.toMillis() - lastAttempt < RECEIPT_RETRY_MIN_INTERVAL_MS) {
      return null;
    }
    const claimed: ReceiptRecord = {
      status: 'failed',
      attempts: record.attempts + 1,
      lastAttemptAt: now,
      lastErrorType: record.lastErrorType ?? null,
    };
    transaction.update(ref, { receiptEmail: claimed });
    return { order, record: claimed };
  });
}

async function loadReceiptFacts(
  db: ReceiptFirestoreLike,
  orderId: string,
  order: Record<string, unknown>
): Promise<ReceiptOrderFacts> {
  const positions = await db
    .collection(TICKETS_COLLECTION)
    .where('orderId', '==', orderId)
    .get();
  return {
    orderId,
    reference: String(order['m_payment_id'] ?? ''),
    buyerEmail: String(order['buyerEmail'] ?? ''),
    buyerName: String(order['buyerName'] ?? ''),
    recoveryToken: typeof order['recoveryToken'] === 'string' ? order['recoveryToken'] : null,
    amount: Number(order['amount']),
    positions: positions.docs.map((doc) => {
      const data = doc.data() ?? {};
      return {
        bookingRef: typeof data['bookingRef'] === 'string' ? data['bookingRef'] : doc.id,
        attendeeName: typeof data['attendeeName'] === 'string' ? data['attendeeName'] : '',
        // Stored ticket type slug, the same value the notification handler passes.
        ticketType: data['ticketType'] as ConfirmationEmailPosition['ticketType'],
        chosenDay: typeof data['chosenDay'] === 'string' ? data['chosenDay'] : null,
      };
    }),
  };
}

/**
 * Bounded retry of failed receipts, run by the reconcile cron: paid orders whose
 * `receiptEmail.status` is 'failed' with fewer than RECEIPT_MAX_ATTEMPTS attempts, paid within
 * RECEIPT_RETRY_LOOKBACK_MS, at most RECEIPT_RETRY_BATCH_LIMIT per run. Orders without a
 * `receiptEmail` field (those that predate it) and orders marked 'sent' are never touched.
 *
 * A missing composite index fails soft: a warning is logged and the summary says so, so the rest
 * of the reconcile run is unaffected. Any other query error is thrown to the caller.
 */
export async function retryFailedReceipts(
  now: Timestamp,
  deps: { db?: ReceiptFirestoreLike; budgetMs?: number; clock?: () => number } = {}
): Promise<ReceiptRetrySummary> {
  const db = deps.db ?? defaultDb();
  let candidates: ReceiptDocSnapshotLike[];
  try {
    candidates = await findFailedReceiptOrders(db, now);
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;
    console.warn(
      '[ticket-receipt] Failed-receipt query needs the (receiptEmail.status, purchasedAt) index; retry skipped',
      { errorType: safeErrorType(error) }
    );
    return { scanned: 0, resent: 0, stillFailing: 0, deferred: 0, skipped: 'missing-index' };
  }

  const summary: ReceiptRetrySummary = {
    scanned: candidates.length,
    resent: 0,
    stillFailing: 0,
    deferred: 0,
    skipped: null,
  };
  const clock = deps.clock ?? Date.now;
  const deadline = clock() + (deps.budgetMs ?? RECEIPT_RETRY_TIME_BUDGET_MS);
  for (const candidate of candidates) {
    if (clock() >= deadline) {
      summary.deferred += 1;
      continue;
    }
    const claim = await claimRetry(db, candidate.id, now);
    if (!claim) continue;
    const ref = db.collection(ORDERS_COLLECTION).doc(candidate.id);
    let sendError: unknown = null;
    let failed = false;
    try {
      await sendOrderReceipt(await loadReceiptFacts(db, candidate.id, claim.order));
    } catch (error) {
      failed = true;
      sendError = error;
      logFailureSafely('[ticket-receipt] receipt retry failed', error);
    }
    try {
      await ref.update({
        receiptEmail: receiptRecord(claim.record.attempts, now, sendError, failed),
      });
    } catch (writeError) {
      logFailureSafely('[ticket-receipt] could not record receipt retry outcome', writeError);
    }
    if (failed) summary.stillFailing += 1;
    else summary.resent += 1;
  }
  return summary;
}
