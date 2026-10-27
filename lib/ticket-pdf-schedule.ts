import { TICKET_PRODUCTS, productIdForSlug } from '@/lib/data/ticket-presentation';
import { formatShowDay } from '@/lib/show-day-format';

/**
 * ticket-pdf (D11 rev) — which date a ticket prints, taken from data that already exists and
 * never invented. A buyer-chosen day prints that day, an 'event', 'pass' or 'programme' product
 * (Symposium, WOSA Conference) prints its own `when` and `meta` from TICKET_PRODUCTS (the source
 * the live tickets page prints), and anything else (workshop, unmapped slug) is unconfirmed,
 * which renders the "To be confirmed" pill.
 */

export interface TicketTypeTraits {
  slug: string;
  /** The Sanity ticket type name: the title printed on the ticket and in the email. */
  name?: string | null;
  requiresDaySelection?: boolean | null;
}

export type TicketScheduleKind = 'chosen-day' | 'product' | 'unconfirmed';

export interface ResolvedTicketSchedule {
  kind: TicketScheduleKind;
  dateText: string | null;
  metaText: string | null;
}

const UNCONFIRMED: ResolvedTicketSchedule = { kind: 'unconfirmed', dateText: null, metaText: null };
const DATED_PRODUCT_KINDS: readonly string[] = ['event', 'pass', 'programme'];
const DAY_PRODUCT_ID = 'day';

export function resolveTicketSchedule(
  type: TicketTypeTraits,
  chosenDay: string | null
): ResolvedTicketSchedule {
  const productId = productIdForSlug(type.slug);
  // The 'day' product's own text is "Friday, Saturday or Sunday": never printed as a date, so a
  // day product is day-selection even if the type flag could not be read.
  if (type.requiresDaySelection === true || productId === DAY_PRODUCT_ID) {
    return chosenDay
      ? { kind: 'chosen-day', dateText: formatShowDay(chosenDay), metaText: null }
      : UNCONFIRMED;
  }
  const product = productId ? TICKET_PRODUCTS[productId] : null;
  if (product && DATED_PRODUCT_KINDS.includes(product.kind)) {
    return { kind: 'product', dateText: product.when, metaText: product.meta };
  }
  return UNCONFIRMED;
}
