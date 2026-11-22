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
/** The retry stops starting new sends once it has run this long (measured from after the scan);
 *  the rest wait for the next run. The budget alone does not cut off a send already in flight:
 *  that is the job of RECEIPT_SEND_TIMEOUT_MS and RECEIPT_RETRY_DEADLINE_MS below.
 *
 *  Accepted trade-off (lead ruling 22 Nov 2026): if a receipt is delivered but the 'sent' write is
 *  lost, or a send times out yet still delivers, the next run re-sends, so a buyer can get at most
 *  one duplicate per retry, bounded by RECEIPT_MAX_ATTEMPTS. No idempotency key is used: the
 *  receipt PDF is not byte-identical between sends, and a reused key with a different body is
 *  rejected. */
export const RECEIPT_RETRY_TIME_BUDGET_MS = 20 * 1000;
/** One send (facts query, PDF, mailer) is cut off after this long and counted as a failed attempt,
 *  so one hung send cannot eat the whole budget. It may still deliver afterwards. */
export const RECEIPT_SEND_TIMEOUT_MS = 10 * 1000;
/** Hard overall deadline for the whole retry step, scan included. */
export const RECEIPT_RETRY_DEADLINE_MS = 25 * 1000;
/** Most scans of the failed-receipt window per run (a pass that only cleared capped orders away
 *  is repeated so they cannot hide older eligible ones). */
export const RECEIPT_RETRY_SCAN_PASSES = 3;
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
  // The last attempt failing is terminal: 'abandoned' is never returned by the 'failed' query, so
  // capped orders cannot fill the scan window and starve older eligible ones.
  const status = !failed ? 'sent' : attempts >= RECEIPT_MAX_ATTEMPTS ? 'abandoned' : 'failed';
  return {
    status,
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
  /** Retries attempted that failed again (a send that timed out counts here). */
  stillFailing: number;
  /** Candidates left unstarted because the time budget ran out; the next run picks them up. */
  deferred: number;
  /** Receipts that used their last attempt and were moved to the terminal 'abandoned' status. */
  abandoned: number;
  /** 'missing-index': the composite index for the query is missing; the step was skipped.
   *  'timeout': the overall deadline passed; the counts above are what finished before it. */
  skipped: 'missing-index' | 'timeout' | null;
}

function millis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function attemptsOf(data: Record<string, unknown> | undefined): number | null {
  const attempts = (data?.['receiptEmail'] as Partial<ReceiptRecord> | undefined)?.attempts;
  return typeof attempts === 'number' ? attempts : null;
}

/** Moves an order that has used every attempt to the terminal 'abandoned' status, so the
 *  'failed' query never returns it again. A failed bookkeeping write is logged and left for the
 *  next run. */
async function abandonReceipt(
  db: ReceiptFirestoreLike,
  doc: ReceiptDocSnapshotLike,
  now: Timestamp
): Promise<boolean> {
  const record = doc.data()?.['receiptEmail'] as Partial<ReceiptRecord> | undefined;
  try {
    await db.collection(ORDERS_COLLECTION).doc(doc.id).update({
      receiptEmail: {
        status: 'abandoned',
        attempts: record?.attempts ?? RECEIPT_MAX_ATTEMPTS,
        lastAttemptAt: record?.lastAttemptAt ?? now,
        lastErrorType: record?.lastErrorType ?? null,
      },
    });
    return true;
  } catch (error) {
    logFailureSafely('[ticket-receipt] could not mark receipt abandoned', error);
    return false;
  }
}

/**
 * Candidates are failed receipts of paid orders, newest first, still under the attempts cap.
 * A 'failed' order that has already used every attempt (for example one whose last send was cut
 * off mid-flight) is moved to 'abandoned' when met, and the query is repeated (up to
 * RECEIPT_RETRY_SCAN_PASSES times) so such orders cannot fill the scan window and hide older
 * eligible ones.
 */
async function findFailedReceiptOrders(
  db: ReceiptFirestoreLike,
  now: Timestamp,
  summary: ReceiptRetrySummary
): Promise<ReceiptDocSnapshotLike[]> {
  const windowStart = Timestamp.fromMillis(now.toMillis() - RECEIPT_RETRY_LOOKBACK_MS);
  for (let pass = 0; pass < RECEIPT_RETRY_SCAN_PASSES; pass += 1) {
    const snapshot = await db
      .collection(ORDERS_COLLECTION)
      .where('receiptEmail.status', '==', 'failed')
      .where('purchasedAt', '>', windowStart)
      .orderBy('purchasedAt', 'desc')
      .limit(RECEIPT_RETRY_SCAN_LIMIT)
      .get();
    const eligible: ReceiptDocSnapshotLike[] = [];
    let abandonedThisPass = 0;
    for (const doc of snapshot.docs) {
      const attempts = attemptsOf(doc.data());
      if (doc.data()?.['status'] !== 'paid' || attempts === null) continue;
      if (attempts < RECEIPT_MAX_ATTEMPTS) eligible.push(doc);
      else if (await abandonReceipt(db, doc, now)) abandonedThisPass += 1;
    }
    summary.abandoned += abandonedThisPass;
    // Another pass only helps when the window was full and some of it was just cleared away.
    if (snapshot.docs.length < RECEIPT_RETRY_SCAN_LIMIT || abandonedThisPass === 0 || eligible.length > 0) {
      summary.scanned += snapshot.docs.length;
      return eligible.slice(0, RECEIPT_RETRY_BATCH_LIMIT);
    }
  }
  return [];
}

/**
 * Takes the retry for one order inside a transaction: re-checks it is still a paid order whose
 * receipt is 'failed', under the cap and not attempted within the minimum interval, then records
 * the attempt (attempts + 1, lastAttemptAt) BEFORE anything is sent. A 'sent' or 'abandoned'
 * order, a concurrent run's claim, or a capped order all return null, so nothing is sent twice.
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

/** Rejects with a TimeoutError (a name safeErrorType keeps) if `work` has not settled in `ms`. */
async function withSendTimeout<T>(ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error('receipt send timed out');
      error.name = 'TimeoutError';
      reject(error);
    }, ms);
  });
  try {
    return await Promise.race([work, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

interface RetryControl {
  /** Set by the overall deadline: no further order is started after it. */
  stopped: boolean;
  budgetMs: number;
  sendTimeoutMs: number;
  clock: () => number;
}

async function retryOne(
  db: ReceiptFirestoreLike,
  orderId: string,
  now: Timestamp,
  control: RetryControl,
  summary: ReceiptRetrySummary
): Promise<void> {
  const claim = await claimRetry(db, orderId, now);
  if (!claim) return;
  const ref = db.collection(ORDERS_COLLECTION).doc(orderId);
  let sendError: unknown = null;
  let failed = false;
  try {
    await withSendTimeout(
      control.sendTimeoutMs,
      loadReceiptFacts(db, orderId, claim.order).then(sendOrderReceipt)
    );
  } catch (error) {
    failed = true;
    sendError = error;
    logFailureSafely('[ticket-receipt] receipt retry failed', error);
  }
  const record = receiptRecord(claim.record.attempts, now, sendError, failed);
  try {
    await ref.update({ receiptEmail: record });
  } catch (writeError) {
    logFailureSafely('[ticket-receipt] could not record receipt retry outcome', writeError);
  }
  if (failed) {
    summary.stillFailing += 1;
    if (record.status === 'abandoned') summary.abandoned += 1;
  } else {
    summary.resent += 1;
  }
}

async function runRetry(
  db: ReceiptFirestoreLike,
  now: Timestamp,
  control: RetryControl,
  summary: ReceiptRetrySummary
): Promise<void> {
  let candidates: ReceiptDocSnapshotLike[];
  try {
    candidates = await findFailedReceiptOrders(db, now, summary);
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;
    console.warn(
      '[ticket-receipt] Failed-receipt query needs the (receiptEmail.status, purchasedAt) index; retry skipped',
      { errorType: safeErrorType(error) }
    );
    summary.skipped = 'missing-index';
    return;
  }
  const budgetDeadline = control.clock() + control.budgetMs;
  for (const candidate of candidates) {
    if (control.stopped) return;
    if (control.clock() >= budgetDeadline) {
      summary.deferred += 1;
      continue;
    }
    await retryOne(db, candidate.id, now, control, summary);
  }
}

/**
 * Bounded retry of failed receipts, run by the reconcile cron: paid orders whose
 * `receiptEmail.status` is 'failed' with fewer than RECEIPT_MAX_ATTEMPTS attempts, paid within
 * RECEIPT_RETRY_LOOKBACK_MS, at most RECEIPT_RETRY_BATCH_LIMIT per run. Orders without a
 * `receiptEmail` field (those that predate it) and orders marked 'sent' or 'abandoned' are never
 * touched.
 *
 * Time is bounded at three levels: each send is cut off after `sendTimeoutMs`; no new send starts
 * after `budgetMs`; and one hard overall deadline (`deadlineMs`) covers the whole step, scan
 * included, so a hung query or mailer cannot stop the caller from returning. On the deadline the
 * summary so far is returned with `skipped: 'timeout'`.
 *
 * A send that timed out counts as a failed attempt even though it may still deliver; that is the
 * accepted duplicate trade-off (lead ruling 22 Nov 2026): at most one duplicate per retry, bounded
 * by RECEIPT_MAX_ATTEMPTS. A send already in flight is not cancelled by the budget, only by its own
 * timeout or the overall deadline.
 *
 * A missing composite index fails soft: a warning is logged and the summary says so. Any other
 * query error is thrown to the caller.
 */
export async function retryFailedReceipts(
  now: Timestamp,
  deps: {
    db?: ReceiptFirestoreLike;
    budgetMs?: number;
    sendTimeoutMs?: number;
    deadlineMs?: number;
    clock?: () => number;
  } = {}
): Promise<ReceiptRetrySummary> {
  const db = deps.db ?? defaultDb();
  const summary: ReceiptRetrySummary = {
    scanned: 0,
    resent: 0,
    stillFailing: 0,
    deferred: 0,
    abandoned: 0,
    skipped: null,
  };
  const control: RetryControl = {
    stopped: false,
    budgetMs: deps.budgetMs ?? RECEIPT_RETRY_TIME_BUDGET_MS,
    sendTimeoutMs: deps.sendTimeoutMs ?? RECEIPT_SEND_TIMEOUT_MS,
    clock: deps.clock ?? Date.now,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'deadline'>((resolve) => {
    timer = setTimeout(() => resolve('deadline'), deps.deadlineMs ?? RECEIPT_RETRY_DEADLINE_MS);
  });
  try {
    const run = runRetry(db, now, control, summary);
    // If the deadline wins, a later rejection of the abandoned run must not become unhandled.
    run.catch(() => undefined);
    const outcome = await Promise.race([run, deadline]);
    if (outcome === 'deadline') {
      control.stopped = true;
      console.warn('[ticket-receipt] Receipt retry hit its overall deadline; returning what finished');
      summary.skipped = 'timeout';
    }
    return summary;
  } finally {
    clearTimeout(timer);
  }
}
