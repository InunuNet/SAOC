import { resolveEffectivePrice } from '@/lib/checkout-reservation';
import { filterPubliclyListableTicketTypes } from '@/lib/demo-ticket-type';

interface AdmissionPriceFields {
  name: string;
  price: number;
  regularPrice?: number | null;
  earlyBirdCutoff?: string | null;
  demo?: boolean | null;
}

export interface CheapestAdmission<T extends AdmissionPriceFields> {
  type: T;
  /** The price checkout would charge right now (early-bird aware). */
  price: number;
}

/**
 * The publicly listable admission product with the lowest price checkout would charge `now`,
 * or null when there is none. The hub's "{title} from R{min}" anchor and the tickets page's
 * own price block both read this, so the two can never disagree about the cheapest ticket.
 */
export function cheapestAdmission<T extends AdmissionPriceFields>(
  types: T[],
  now: Date
): CheapestAdmission<T> | null {
  let best: CheapestAdmission<T> | null = null;
  for (const type of filterPubliclyListableTicketTypes(types)) {
    const price =
      resolveEffectivePrice({
        price: type.price,
        regularPrice: type.regularPrice ?? null,
        earlyBirdCutoff: type.earlyBirdCutoff ?? null,
        now,
      }) ?? type.price;
    if (best === null || price < best.price) best = { type, price };
  }
  return best;
}

/** Whole rand where the price is whole ("R120"), cents otherwise ("R120.50"). */
export function formatRand(price: number): string {
  return Number.isInteger(price) ? `R${price}` : `R${price.toFixed(2)}`;
}
