import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { ORDERS_COLLECTION } from '@/lib/orders';
import { logFailureSafely, safeErrorType } from '@/lib/safe-log';
import type { Order } from '@/types/index';

/**
 * Records, on the order, how the buyer's receipt email went: after the one send the notification
 * handler makes, one best-effort write of
 * `receiptEmail = { status: 'sent' | 'failed', lastAttemptAt, lastErrorType }` (the error type
 * name only, never the raw error). A failed receipt is therefore visible on the order; resending
 * it is manual for now (an admin resend is future work).
 *
 * The write never changes the notification's outcome: it is capped at RECEIPT_RECORD_CAP_MS, it
 * can never throw, and the handler only reaches it from the call that settled the order.
 */

/** Hard cap on the single outcome write. */
export const RECEIPT_RECORD_CAP_MS = 2000;

export interface ReceiptOutcomeInput {
  orderId: string;
  now: Timestamp;
  failed: boolean;
  /** The send's error when `failed`; only its built-in type label is stored. */
  error?: unknown;
}

function buildRecord(input: ReceiptOutcomeInput): NonNullable<Order['receiptEmail']> {
  return {
    status: input.failed ? 'failed' : 'sent',
    lastAttemptAt: input.now,
    lastErrorType: input.failed ? safeErrorType(input.error) : null,
  };
}

export async function recordReceiptOutcome(
  input: ReceiptOutcomeInput,
  capMs: number = RECEIPT_RECORD_CAP_MS
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), capMs);
    });
    const write = getFirestore(initAdmin())
      .collection(ORDERS_COLLECTION)
      .doc(input.orderId)
      .update({ receiptEmail: buildRecord(input) })
      .then(() => 'written' as const);
    // A rejection after the cap already won must not become an unhandled rejection.
    write.catch(() => undefined);
    const outcome = await Promise.race([write, timedOut]);
    if (outcome === 'timeout') {
      console.warn('[receipt-record] Receipt status write timed out; not recorded');
    }
  } catch (error) {
    logFailureSafely('[receipt-record] could not record receipt delivery status', error);
  } finally {
    clearTimeout(timer);
  }
}
