// F17 (launch-weekend, scope E): the sold-out verdict for each admission SKU, the same
// pooled-capacity check /tickets runs (planPooledCapacity over getSoldCountsByTicketType),
// extracted so the tickets hub can show a sold-out SKU on its own action while its sibling
// stays live. Server-only: it reaches Firestore through the Admin SDK.
//
// This is a DISPLAY HINT. Checkout re-checks capacity authoritatively, so a failure here is
// logged by error name only and yields no sold-out flags rather than blocking the page.
import { sanityFetch } from '@/sanity/lib/fetch';
import { ticketTypesByPoolQuery } from '@/sanity/queries';
import {
  effectiveCapacity,
  planPooledCapacity,
  type CapacityPoolConfig,
} from '@/lib/checkout-reservation';
import { getSoldCountsByTicketType } from '@/lib/data/tickets';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

export interface AdmissionAvailabilitySource {
  slug: string;
  capacity: number;
  releasedQuantity?: number | null;
  capacityPool?: string | null;
  headcountPerUnit?: number | null;
}

interface PoolSibling {
  slug: string | null;
  headcountPerUnit?: number | null;
}

export async function getAdmissionSoldOutBySlug(
  types: AdmissionAvailabilitySource[],
  activeShowId: string | null,
): Promise<Record<string, boolean>> {
  try {
    const soldCounts = await getSoldCountsByTicketType(NATIONAL_SHOW_ID);
    const poolConfigByType: Record<string, CapacityPoolConfig> = {};
    const capacityByType: Record<string, number> = {};
    for (const t of types) {
      const poolKey = t.capacityPool ?? t.slug;
      poolConfigByType[t.slug] = {
        pool: t.capacityPool ?? null,
        headcountPerUnit: t.headcountPerUnit ?? 1,
      };
      const ceiling = effectiveCapacity(t.capacity, t.releasedQuantity);
      capacityByType[poolKey] =
        poolKey in capacityByType ? Math.min(capacityByType[poolKey], ceiling) : ceiling;
    }

    const poolKeys = new Set(
      types.map((t) => t.capacityPool).filter((pool): pool is string => Boolean(pool)),
    );
    for (const poolKey of poolKeys) {
      const siblings =
        (await sanityFetch<PoolSibling[]>({
          query: ticketTypesByPoolQuery,
          params: { pool: poolKey, showId: activeShowId },
          tags: ['ticketType', 'sanity'],
        })) ?? [];
      for (const sibling of siblings) {
        if (!sibling.slug || sibling.slug in poolConfigByType) continue;
        poolConfigByType[sibling.slug] = {
          pool: poolKey,
          headcountPerUnit: sibling.headcountPerUnit ?? 1,
        };
      }
    }

    const soldOutBySlug: Record<string, boolean> = {};
    for (const t of types) {
      const check = planPooledCapacity({
        requestedQtyByType: { [t.slug]: 1 },
        soldCountsByType: soldCounts,
        capacityByType,
        poolConfigByType,
      });
      soldOutBySlug[t.slug] = check.kind === 'over-capacity';
    }
    return soldOutBySlug;
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[lib/data/admission-availability] sold-out read failed (${name})`);
    return {};
  }
}
