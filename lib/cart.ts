// F1 (ticketing-multi-line-item-cart-ui) — pure cart-math helpers for the buyer-facing
// multi-line-item ticket selection UI. No Firestore/Sanity import, client-bundle-safe,
// same convention as lib/tickets-constants.ts.
//
// THE DEFECT CLASS THIS TARGETS
// The architect brief's explicit warning: "a displayed total that disagrees with the
// charged total is the defect to design against." The riskiest way that happens is a
// second, independent price source drifting from the one the server actually fetched.
// computeCartTotal() takes NO price argument except the `types` array itself — there is
// nowhere for a second, hardcoded price table to live in this file.
import type { CheckoutLineItemInput } from '@/app/api/tickets/checkout/route';
import { MAX_LINE_ITEMS } from '@/lib/tickets-constants';

/**
 * Client-side UX ceiling mirroring app/api/tickets/checkout/route.ts's own
 * MAX_LINE_ITEMS. Re-exported under this name (rather than having callers import
 * MAX_LINE_ITEMS directly from lib/tickets-constants.ts) purely to avoid touching
 * components/tickets/useTicketCart.ts — see contracts/golden/
 * ticketing-line-item-cap-drift-guard/README.md. lib/tickets-constants.ts is free of
 * firebase-admin/Sanity imports, so it (unlike app/api/tickets/checkout/route.ts) is
 * safe to import a VALUE from in client-bundled code — confirmed via `pnpm build`. This
 * is a UX-only pre-check; the server's own MAX_LINE_ITEMS remains the real,
 * authoritative boundary and is never bypassed by this constant drifting — see
 * contracts/golden/ticketing-multi-line-item-cart-ui/README.md, "Pre-redirect amount
 * display" section for the same client/server-authority split applied to price.
 */
export const CART_MAX_LINE_ITEMS = MAX_LINE_ITEMS;

export interface CartTicketTypeInfo {
  slug: string;
  /** Server-resolved (Sanity, via the page's own server-side fetch) — this is the ONLY
   *  price source these functions ever read. */
  price: number;
  soldOut: boolean;
  /** F5 (ticketing-f5-day-attendees) — required, same posture as TicketTypeCardData's own
   *  field; buildLineItemsFromCart() reads it to decide which types carry a chosenDay. */
  requiresDaySelection: boolean;
}

export interface CartAttendee {
  attendeeName: string;
  attendeeEmail: string;
}

/**
 * Sums quantities[slug] * that slug's price, reading ONLY from the `types` array. A
 * slug present in `quantities` but absent from `types` (a stale/removed ticket type) is
 * EXCLUDED from the total — never priced at 0-and-silently-kept, never thrown.
 */
export function computeCartTotal(
  quantities: Record<string, number>,
  types: CartTicketTypeInfo[]
): number {
  const priceBySlug = new Map(types.map((type) => [type.slug, type.price]));
  let total = 0;
  for (const [slug, quantity] of Object.entries(quantities)) {
    if (quantity <= 0) continue;
    const price = priceBySlug.get(slug);
    if (price === undefined) continue;
    total += quantity * price;
  }
  return total;
}

/** Sum of every quantity in the cart, ignoring slugs whose quantity is <= 0. */
export function cartItemCount(quantities: Record<string, number>): number {
  let count = 0;
  for (const quantity of Object.values(quantities)) {
    if (quantity > 0) count += quantity;
  }
  return count;
}

/**
 * Expands { slug: quantity } into a flat, ORDERED array of CheckoutLineItemInput,
 * pairing each unit of a type, IN ORDER, with the attendee row assigned to it in
 * `attendeesByType[slug]`. `typesOrder` fixes the between-type ordering (must be the
 * SAME array the page rendered the type cards in), so a submitted cart's line-item
 * order is deterministic and reproducible.
 *
 * THROWS if `attendeesByType[slug]?.length !== quantities[slug]` for any selected type
 * — a mismatched row count is a UI bug and must fail loudly before a POST is ever sent,
 * never silently pad or truncate the cart.
 *
 * F5 (ticketing-f5-day-attendees): `chosenDayByType[slug]` pairs each unit with its chosen
 * day the SAME row-per-unit way `attendeesByType` already does. A slug absent from (or with
 * an empty array in) `chosenDayByType` — every type that doesn't require a day — produces
 * `chosenDay: undefined` for its line items; a NON-EMPTY entry whose length doesn't match
 * the quantity THROWS, the same "UI bug must fail loudly" posture as the attendee check.
 */
export function buildLineItemsFromCart(
  quantities: Record<string, number>,
  attendeesByType: Record<string, CartAttendee[]>,
  typesOrder: string[],
  chosenDayByType: Record<string, string[]> = {}
): CheckoutLineItemInput[] {
  const lineItems: CheckoutLineItemInput[] = [];

  for (const slug of typesOrder) {
    const quantity = quantities[slug] ?? 0;
    if (quantity <= 0) continue;

    const attendees = attendeesByType[slug] ?? [];
    if (attendees.length !== quantity) {
      throw new Error(
        `Attendee row count for '${slug}' (${attendees.length}) does not match its quantity (${quantity}).`
      );
    }

    const chosenDays = chosenDayByType[slug] ?? [];
    if (chosenDays.length > 0 && chosenDays.length !== quantity) {
      throw new Error(
        `Chosen-day row count for '${slug}' (${chosenDays.length}) does not match its quantity (${quantity}).`
      );
    }

    attendees.forEach((attendee, index) => {
      const chosenDay = chosenDays[index];
      lineItems.push(
        chosenDay === undefined
          ? {
              ticketType: slug,
              attendeeName: attendee.attendeeName,
              attendeeEmail: attendee.attendeeEmail,
            }
          : {
              ticketType: slug,
              attendeeName: attendee.attendeeName,
              attendeeEmail: attendee.attendeeEmail,
              chosenDay,
            }
      );
    });
  }

  return lineItems;
}
