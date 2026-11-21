import { effectiveCapacity, type CapacityPoolConfig } from '@/lib/checkout-reservation';
import {
  registerDayCapPool,
  type LateSettlementCapacity,
  type LoadLateCapacity,
} from '@/lib/late-settlement';
import { DAY_VISITOR_DAY_CAP_POOL_KEY } from '@/lib/provisional-figures';
import { safeErrorType } from '@/lib/safe-log';
import { client } from '@/sanity/lib/client';
import { ticketTypeBySlugQuery, ticketTypesByPoolQuery } from '@/sanity/queries';

/**
 * Builds the capacity inputs for a late-settled order from live Sanity reads, the same source and
 * the same rules checkout used when it reserved the seats (effective capacity = capacity capped
 * by releasedQuantity, shared pools keyed by `capacityPool`, day-visitor's per-day cap).
 *
 * Runs outside the paid transaction, and only when the hold had already expired. Returns null when
 * the capacity cannot be established (a CMS read failed, or a type is missing or unusable): the
 * order then settles with `overCapacity: null` (unverified) rather than being refused, because
 * the buyer has already paid.
 */

interface CapacityTypeDoc {
  capacity: unknown;
  releasedQuantity: unknown;
  requiresDaySelection: unknown;
  capacityPool: unknown;
  headcountPerUnit: unknown;
}

interface PoolSiblingDoc {
  slug: string | null;
  headcountPerUnit: unknown;
}

/** The CMS client is null when its project id is unset; that surfaces as a failed lookup. */
function sanityClient(): NonNullable<typeof client> {
  if (!client) throw new Error('Sanity client is not configured');
  return client;
}

function usableCapacity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function usableReleased(value: unknown): value is number | null | undefined {
  return value === null || value === undefined || (typeof value === 'number' && value >= 0);
}

function usablePool(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() !== '');
}

function usableHeadcount(value: unknown): value is number | null | undefined {
  return value === null || value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 1);
}

interface UsableTypeDoc {
  ceiling: number;
  requiresDaySelection: boolean;
  pool: string | null;
  headcountPerUnit: number;
}

/** The validated capacity facts for one type, or null when it is missing or unusable. */
async function fetchTypeDoc(slug: string): Promise<UsableTypeDoc | null> {
  const doc = await sanityClient().fetch<CapacityTypeDoc | null>(ticketTypeBySlugQuery, { slug });
  if (!doc) return null;
  const { capacity, releasedQuantity, capacityPool, headcountPerUnit } = doc;
  if (!usableCapacity(capacity) || !usableReleased(releasedQuantity)) return null;
  if (!usablePool(capacityPool) || !usableHeadcount(headcountPerUnit)) return null;
  return {
    ceiling: effectiveCapacity(capacity, releasedQuantity),
    requiresDaySelection: doc.requiresDaySelection === true,
    pool: capacityPool ?? null,
    headcountPerUnit: headcountPerUnit ?? 1,
  };
}

async function addPoolSiblings(
  poolConfigByType: Record<string, CapacityPoolConfig>,
  showId: string
): Promise<boolean> {
  const poolKeys = new Set(
    Object.values(poolConfigByType)
      .map((config) => config.pool)
      .filter((pool): pool is string => pool !== null)
  );
  for (const pool of poolKeys) {
    const siblings =
      (await sanityClient().fetch<PoolSiblingDoc[]>(ticketTypesByPoolQuery, { pool, showId })) ?? [];
    for (const sibling of siblings) {
      if (!sibling.slug || sibling.slug in poolConfigByType) continue;
      if (!usableHeadcount(sibling.headcountPerUnit)) return false;
      poolConfigByType[sibling.slug] = { pool, headcountPerUnit: sibling.headcountPerUnit ?? 1 };
    }
  }
  return true;
}

async function buildCapacity(
  showId: string,
  positions: { ticketType: string; chosenDay: string | null }[]
): Promise<LateSettlementCapacity | null> {
  const capacity: LateSettlementCapacity = {
    capacityByType: {},
    poolConfigByType: {},
    dayCapRequestedQtyByType: {},
    dayCapCapacityByType: {},
    dayCapPoolConfigByType: {},
  };
  const slugs = [...new Set(positions.map((position) => position.ticketType))];
  const daySelectionSlugs = new Set<string>();
  let dayVisitorCapacity: number | undefined;

  for (const slug of slugs) {
    const doc = await fetchTypeDoc(slug);
    if (!doc) return null;
    if (doc.requiresDaySelection) daySelectionSlugs.add(slug);
    if (slug === DAY_VISITOR_DAY_CAP_POOL_KEY) {
      dayVisitorCapacity = doc.ceiling;
      continue;
    }
    const poolKey = doc.pool ?? slug;
    capacity.capacityByType[poolKey] = Math.min(
      capacity.capacityByType[poolKey] ?? doc.ceiling,
      doc.ceiling
    );
    capacity.poolConfigByType[slug] = { pool: doc.pool, headcountPerUnit: doc.headcountPerUnit };
  }

  if (!(await addPoolSiblings(capacity.poolConfigByType, showId))) return null;

  const dayCapPositions = positions.filter((position) => daySelectionSlugs.has(position.ticketType));
  if (dayCapPositions.length === 0) return capacity;
  if (dayVisitorCapacity === undefined) {
    const dayVisitor = await fetchTypeDoc(DAY_VISITOR_DAY_CAP_POOL_KEY);
    if (!dayVisitor) return null;
    dayVisitorCapacity = dayVisitor.ceiling;
  }
  for (const position of dayCapPositions) {
    // A day-qualified type with no recorded day cannot be placed on a day: leave it to the
    // legacy carve-out in the planner rather than guessing.
    if (position.chosenDay) {
      registerDayCapPool(capacity, position.ticketType, position.chosenDay, dayVisitorCapacity);
    }
  }
  return capacity;
}

export const loadLateSettlementCapacity: LoadLateCapacity = async ({ showId, positions }) => {
  try {
    return await buildCapacity(showId, positions);
  } catch (error) {
    console.warn('[late-settlement] Capacity lookup failed; settling with capacity unverified', {
      errorType: safeErrorType(error),
    });
    return null;
  }
};
