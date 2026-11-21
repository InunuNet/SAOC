import type { Timestamp } from 'firebase-admin/firestore';

import {
  planPooledCapacity,
  resolveDayQualifiedPoolKey,
  type CapacityPoolConfig,
} from '@/lib/checkout-reservation';
import {
  DAY_VISITOR_DAY_CAP_POOL_KEY,
  DAY_VISITOR_SHAPED_SLUGS,
} from '@/lib/provisional-figures';

/**
 * Late-payment settlement: a payment that lands after the reservation hold lapsed still
 * settles (the buyer has paid, so the ticket is always issued), but the capacity the lapsed
 * hold no longer protected is rechecked so an oversell is recorded on the order for a human.
 * The recheck runs only AFTER the settlement committed (lib/late-settlement-flag.ts); nothing
 * here is ever part of the paid transaction.
 *
 * This module is pure. It mirrors the capacity arithmetic app/api/tickets/checkout/route.ts
 * runs at reservation time (the same planPooledCapacity, the same day-cap pooling and the same
 * legacy no-chosenDay carve-out), fed by the sold counts the caller read inside the paid
 * transaction.
 */

/** What is written to `orders/{id}.settlement` when the hold had expired at settlement time. */
export interface OrderSettlementFlags {
  lateAfterHoldExpiry: true;
  /** true: sold count exceeds capacity with this order counted. false: capacity was fine.
   *  null: capacity could not be loaded (CMS unreachable or type unusable), so unverified. */
  overCapacity: boolean | null;
  detectedAt: Timestamp;
}

export interface LatePosition {
  ticketType: string;
  chosenDay: string | null;
}

/** Capacity inputs for the paid order's own ticket types, built outside the transaction. */
export interface LateSettlementCapacity {
  capacityByType: Record<string, number>;
  poolConfigByType: Record<string, CapacityPoolConfig>;
  dayCapRequestedQtyByType: Record<string, number>;
  dayCapCapacityByType: Record<string, number>;
  dayCapPoolConfigByType: Record<string, CapacityPoolConfig>;
}

export type LoadLateCapacity = (input: {
  showId: string;
  positions: LatePosition[];
  /** Aborted when the caller's time cap runs out, so the CMS requests stop too. */
  signal?: AbortSignal;
}) => Promise<LateSettlementCapacity | null>;

export function hasDayCapPositions(capacity: LateSettlementCapacity): boolean {
  return Object.keys(capacity.dayCapRequestedQtyByType).length > 0;
}

/** Positions of this order counted per ticket type, day-visitor excluded (it has no
 *  unqualified pool, only its per-day cap), exactly as checkout does. */
function requestedQtyByType(positions: LatePosition[]): Record<string, number> {
  const requested: Record<string, number> = {};
  for (const position of positions) {
    if (position.ticketType === DAY_VISITOR_DAY_CAP_POOL_KEY) continue;
    requested[position.ticketType] = (requested[position.ticketType] ?? 0) + 1;
  }
  return requested;
}

function addLegacyNoChosenDayHeads(
  soldByTypeAndDay: Record<string, number>,
  dayCapPoolConfigByType: Record<string, CapacityPoolConfig>
): Record<string, number> {
  const legacyHeads = DAY_VISITOR_SHAPED_SLUGS.reduce(
    (total, slug) => total + (soldByTypeAndDay[slug] ?? 0),
    0
  );
  const merged = { ...soldByTypeAndDay };
  if (legacyHeads === 0) return merged;
  const poolKeys = new Set(
    Object.values(dayCapPoolConfigByType)
      .map((config) => config.pool)
      .filter((pool): pool is string => pool !== null)
  );
  for (const poolKey of poolKeys) {
    merged[poolKey] = (merged[poolKey] ?? 0) + legacyHeads;
  }
  return merged;
}

/**
 * True when the live sold counts plus this order's own positions exceed capacity in either the
 * shared pool or a per-day cap. `soldCounts` must NOT include this order's own positions (the
 * caller subtracts them: see subtractCounts), so adding them as the requested quantity is what
 * "once this order is counted" means.
 */
export function isOverCapacityAfterLateSettlement(input: {
  positions: LatePosition[];
  capacity: LateSettlementCapacity;
  soldCounts: Record<string, number>;
  soldCountsByDay: Record<string, number> | null;
}): boolean {
  const { positions, capacity } = input;
  const pooled = planPooledCapacity({
    requestedQtyByType: requestedQtyByType(positions),
    soldCountsByType: input.soldCounts,
    capacityByType: capacity.capacityByType,
    poolConfigByType: capacity.poolConfigByType,
  });
  if (pooled.kind === 'over-capacity') return true;
  if (!input.soldCountsByDay || !hasDayCapPositions(capacity)) return false;
  const dayCap = planPooledCapacity({
    requestedQtyByType: capacity.dayCapRequestedQtyByType,
    soldCountsByType: addLegacyNoChosenDayHeads(
      input.soldCountsByDay,
      capacity.dayCapPoolConfigByType
    ),
    capacityByType: capacity.dayCapCapacityByType,
    poolConfigByType: capacity.dayCapPoolConfigByType,
  });
  return dayCap.kind === 'over-capacity';
}

/** Registers every day-visitor-shaped slug for `chosenDay` under the one shared per-day pool,
 *  the same registration checkout performs. */
export function registerDayCapPool(
  capacity: LateSettlementCapacity,
  ticketType: string,
  chosenDay: string,
  dayCapCapacity: number
): void {
  const requestKey = resolveDayQualifiedPoolKey(ticketType, chosenDay, true);
  const poolKey = resolveDayQualifiedPoolKey(DAY_VISITOR_DAY_CAP_POOL_KEY, chosenDay, true);
  capacity.dayCapRequestedQtyByType[requestKey] =
    (capacity.dayCapRequestedQtyByType[requestKey] ?? 0) + 1;
  capacity.dayCapCapacityByType[poolKey] = dayCapCapacity;
  for (const slug of DAY_VISITOR_SHAPED_SLUGS) {
    capacity.dayCapPoolConfigByType[resolveDayQualifiedPoolKey(slug, chosenDay, true)] = {
      pool: poolKey,
      headcountPerUnit: 1,
    };
  }
}

/** `counts` minus one unit per key, never below zero. After the commit the order's own positions
 *  are 'paid' and already inside the live sold counts, so they are taken out before the planner
 *  adds them back as the "requested" quantity. */
export function subtractCounts(
  counts: Record<string, number>,
  keys: string[]
): Record<string, number> {
  const remaining = { ...counts };
  for (const key of keys) {
    if (key in remaining) remaining[key] = Math.max(0, remaining[key] - 1);
  }
  return remaining;
}

/** The key getSoldCountsByTicketTypeAndDay files a position under. */
export function dayCountKey(position: LatePosition): string {
  return DAY_VISITOR_SHAPED_SLUGS.includes(position.ticketType) && position.chosenDay
    ? `${position.ticketType}::${position.chosenDay}`
    : position.ticketType;
}
