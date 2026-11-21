import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { getSoldCountsByTicketType, getSoldCountsByTicketTypeAndDay } from '@/lib/data/tickets';
import { initAdmin } from '@/lib/firebase-admin';
import {
  hasDayCapPositions,
  dayCountKey,
  isOverCapacityAfterLateSettlement,
  subtractCounts,
  type LatePosition,
  type LoadLateCapacity,
  type OrderSettlementFlags,
} from '@/lib/late-settlement';
import { ORDERS_COLLECTION } from '@/lib/orders';
import { DAY_VISITOR_SHAPED_SLUGS } from '@/lib/provisional-figures';
import { safeErrorType } from '@/lib/safe-log';

/**
 * Late-payment flag, written AFTER the payment settled. The paid transaction in lib/orders.ts is
 * untouched by all of this: the order has already been committed 'paid' and its ticket issued
 * before anything here runs, and nothing here can change the HTTP response or throw into the
 * caller.
 *
 * The flag is informational (a human reviews an oversell), so everything is best effort and
 * bounded: the capacity lookup and sold-count read share one time cap, after which the flag is
 * written with `overCapacity: null` (unverified). If even that write fails, the console.warn is
 * all that is left.
 */

/** Hard cap on the capacity lookup and sold-count reads together. */
export const LATE_SETTLEMENT_TIME_CAP_MS = 2000;
/** Hard cap on the single flag write. */
export const LATE_SETTLEMENT_WRITE_CAP_MS = 2000;

export interface FlagLateSettlementInput {
  orderId: string;
  /** The order reference (`m_payment_id`). */
  reference: string;
  positions: LatePosition[];
  /** The hold's expiry as read before the commit. */
  expiresAt: Timestamp | null;
  /** The settlement time passed to the paid write. */
  settledAt: Timestamp;
}

export interface FlagLateSettlementDeps {
  loadCapacity: LoadLateCapacity;
  timeCapMs?: number;
  writeCapMs?: number;
}

type Capped<T> = { ok: true; value: T } | { ok: false };

/** Runs `work` for at most `capMs`; a timeout aborts its signal and yields `{ ok: false }`, a
 *  rejection is logged (error type only) and yields `{ ok: false }` too. Never rejects. */
async function withTimeCap<T>(
  capMs: number,
  label: string,
  work: (signal: AbortSignal) => Promise<T>
): Promise<Capped<T>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<Capped<T>>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false });
    }, capMs);
  });
  const done = work(controller.signal).then(
    (value): Capped<T> => ({ ok: true, value }),
    (error: unknown): Capped<T> => {
      console.warn(`[late-settlement] ${label} failed`, { errorType: safeErrorType(error) });
      return { ok: false };
    }
  );
  try {
    return await Promise.race([done, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

type Assessment = { kind: 'already-flagged' } | { kind: 'assessed'; overCapacity: boolean | null };

async function assessCapacity(
  input: FlagLateSettlementInput,
  deps: FlagLateSettlementDeps,
  signal: AbortSignal
): Promise<Assessment> {
  const db = getFirestore(initAdmin());
  const orderSnapshot = await db.collection(ORDERS_COLLECTION).doc(input.orderId).get();
  const order = orderSnapshot.data();
  if (order?.['settlement']) return { kind: 'already-flagged' };
  const showId = order?.['showId'];
  if (typeof showId !== 'string') return { kind: 'assessed', overCapacity: null };

  const capacity = await deps.loadCapacity({ showId, positions: input.positions, signal });
  if (!capacity) return { kind: 'assessed', overCapacity: null };
  // The order itself is already paid, so its positions are inside these live counts; they are
  // taken back out because the planner adds them as the requested quantity.
  const soldCounts = subtractCounts(
    await getSoldCountsByTicketType(showId),
    input.positions.map((position) => position.ticketType)
  );
  const soldCountsByDay = hasDayCapPositions(capacity)
    ? subtractCounts(
        await getSoldCountsByTicketTypeAndDay(showId, new Set(DAY_VISITOR_SHAPED_SLUGS)),
        input.positions.map(dayCountKey)
      )
    : null;
  return {
    kind: 'assessed',
    overCapacity: isOverCapacityAfterLateSettlement({
      positions: input.positions,
      capacity,
      soldCounts,
      soldCountsByDay,
    }),
  };
}

/**
 * Call only from the notification that actually moved the order to paid. Returns without doing
 * anything when the hold had not expired at settlement time. Never throws.
 */
export async function flagLateSettlement(
  input: FlagLateSettlementInput,
  deps: FlagLateSettlementDeps
): Promise<void> {
  try {
    if (!input.expiresAt || input.expiresAt.toMillis() > input.settledAt.toMillis()) return;

    const assessed = await withTimeCap(
      deps.timeCapMs ?? LATE_SETTLEMENT_TIME_CAP_MS,
      'capacity assessment',
      (signal) => assessCapacity(input, deps, signal)
    );
    if (assessed.ok && assessed.value.kind === 'already-flagged') return;
    const overCapacity = assessed.ok && assessed.value.kind === 'assessed' ? assessed.value.overCapacity : null;

    // Reference and ticket types only: no buyer name or email in a log line.
    console.warn('[late-settlement] Payment settled after the reservation hold expired', {
      reference: input.reference,
      ticketTypes: [...new Set(input.positions.map((position) => position.ticketType))],
      overCapacity,
    });

    const settlement: OrderSettlementFlags = {
      lateAfterHoldExpiry: true,
      overCapacity,
      detectedAt: input.settledAt,
    };
    // One set-with-merge of the single `settlement` field; it is only reached when the read
    // above found no existing flag (or could not run), and a replayed notification never gets
    // here at all because it does not commit.
    const written = await withTimeCap(
      deps.writeCapMs ?? LATE_SETTLEMENT_WRITE_CAP_MS,
      'flag write',
      async () => {
        const db = getFirestore(initAdmin());
        await db.collection(ORDERS_COLLECTION).doc(input.orderId).set({ settlement }, { merge: true });
      }
    );
    if (!written.ok) {
      console.warn('[late-settlement] Flag not recorded; the warning above is the only record', {
        reference: input.reference,
      });
    }
  } catch (error) {
    console.warn('[late-settlement] Flagging failed', { errorType: safeErrorType(error) });
  }
}
