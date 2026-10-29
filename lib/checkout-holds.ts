import { stillHoldsSeat } from './seat-holds';

/**
 * Checkout abuse numbers and the pure held-seat budget (SEC-02). The values are NAMED in
 * .agent/memory/project/specs/sec-abuse-controls/spec.md D3/D4; changing one is a spec change.
 * 40 held seats is two full carts (MAX_LINE_ITEMS = 20), so a buyer who abandons one cart and
 * starts again inside the 30 minute hold is not locked out.
 */
export const CHECKOUT_LIMITS = Object.freeze({
  ipRequests: 12,
  ipWindowMs: 15 * 60_000,
  buyerRequests: 6,
  buyerWindowMs: 3_600_000,
  actorMaxHeldSeats: 40,
  actorMaxHeldPerType: 40,
  buyerMaxHeldSeats: 40,
});

export type CheckoutLimits = typeof CHECKOUT_LIMITS;

export interface HeldSeatSummary {
  total: number;
  byType: Record<string, number>;
}

interface HeldSeatDoc {
  status?: unknown;
  expiresAt?: unknown;
  ticketType?: unknown;
}

const RESERVED_STATUS = 'reserved';

/** Live `reserved` seats only (paid seats are sales, not holds). Uses the ledger's expiry rule. */
export function summariseHeldSeats(docs: readonly HeldSeatDoc[], nowMs: number): HeldSeatSummary {
  const byType: Record<string, number> = {};
  let total = 0;
  for (const doc of docs) {
    if (doc.status !== RESERVED_STATUS) continue;
    if (!stillHoldsSeat(doc, nowMs)) continue;
    const ticketType = doc.ticketType as string;
    byType[ticketType] = (byType[ticketType] ?? 0) + 1;
    total += 1;
  }
  return { total, byType };
}

export type HoldBudgetDecision =
  | { ok: true }
  | { ok: false; reason: 'actor-total' | 'actor-type' | 'buyer-total' };

export function evaluateHoldBudget(input: {
  requestedByType: Record<string, number>;
  heldByActor: HeldSeatSummary;
  heldByBuyer: HeldSeatSummary;
  limits?: CheckoutLimits;
}): HoldBudgetDecision {
  const limits = input.limits ?? CHECKOUT_LIMITS;
  const requested = Object.values(input.requestedByType).reduce((sum, qty) => sum + qty, 0);

  // anchor: budget-actor-total
  if (input.heldByActor.total + requested > limits.actorMaxHeldSeats) {
    return { ok: false, reason: 'actor-total' };
  }
  for (const [ticketType, qty] of Object.entries(input.requestedByType)) {
    // anchor: budget-actor-type
    if ((input.heldByActor.byType[ticketType] ?? 0) + qty > limits.actorMaxHeldPerType) {
      return { ok: false, reason: 'actor-type' };
    }
  }
  // anchor: budget-buyer-total
  if (input.heldByBuyer.total + requested > limits.buyerMaxHeldSeats) {
    return { ok: false, reason: 'buyer-total' };
  }
  return { ok: true };
}
