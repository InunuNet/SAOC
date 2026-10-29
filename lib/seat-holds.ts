/**
 * The single seat-hold expiry rule, shared by the capacity ledger (lib/data/tickets.ts) and the
 * checkout held-seat budget (lib/checkout-holds.ts), so the two can never disagree on what
 * "held" means. Pure: no firebase-admin import and no clock of its own; the caller supplies
 * `nowMs`.
 *
 * Expiry is read-time only. A `reserved` position stops counting the instant its `expiresAt`
 * passes; no scheduler, sweeper or reconcile run is involved, and nothing here writes a status
 * (a cleanup that cancelled would race a payment that lands after expiry).
 *
 * `paid` is never released by expiry. A `reserved` document whose `expiresAt` is missing or not
 * a timestamp still holds: the rule fails closed so a writer that forgets the field cannot
 * silently release seats.
 */

const RESERVED_STATUS = 'reserved';
const PAID_STATUS = 'paid';

interface SeatHoldDoc {
  status?: unknown;
  expiresAt?: unknown;
  ticketType?: unknown;
}

function toMillisOrNull(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const toMillis = (value as { toMillis?: unknown }).toMillis;
  return typeof toMillis === 'function' ? (toMillis.call(value) as number) : null;
}

export function stillHoldsSeat(data: SeatHoldDoc, nowMs: number): boolean {
  if (data.status !== RESERVED_STATUS) return true;
  const expiresAtMs = toMillisOrNull(data.expiresAt);
  if (expiresAtMs === null) return true;
  // anchor: held-expired
  return expiresAtMs > nowMs;
}

/** Seats currently held per ticket type: reserved-and-unexpired plus paid. Other statuses are not seats. */
export function tallySeatHolds(
  docs: readonly SeatHoldDoc[],
  nowMs: number,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const doc of docs) {
    if (doc.status !== RESERVED_STATUS && doc.status !== PAID_STATUS) continue;
    if (!stillHoldsSeat(doc, nowMs)) continue;
    const ticketType = doc.ticketType as string;
    counts[ticketType] = (counts[ticketType] ?? 0) + 1;
  }
  return counts;
}
