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

/**
 * F3 (ticketing-flow-redesign) — per-day attendee-row state for the Day Visitor per-day
 * quantity picker screen. Each day's array length IS that day's quantity — no
 * separately-tracked quantity number to drift out of sync with it. See
 * contracts/golden/ticketing-flow-redesign-f3/day-quantity-picker.golden.md §0-1
 * (second correction, 2026-08-24) for the root-cause analysis this replaces the prior
 * flat-array line-item expansion design to fix.
 */
export type AttendeesByDay = Record<string, CartAttendee[]>;

/**
 * Resizes ONLY `attendeesByDay[day]`'s own row array to `quantity` — appending
 * `makeAttendee()` rows at that day's own tail, or truncating that day's own tail. Every
 * OTHER day's array is untouched, so editing Monday's stepper can never shift which rows
 * belong to Wednesday, no matter what order the buyer visits days in.
 */
export function updateAttendeesByDay(
  attendeesByDay: AttendeesByDay,
  day: string,
  quantity: number,
  makeAttendee: () => CartAttendee
): AttendeesByDay {
  const current = attendeesByDay[day] ?? [];
  if (quantity === current.length) return attendeesByDay;
  const nextRows =
    quantity < current.length
      ? current.slice(0, quantity)
      : [...current, ...Array.from({ length: quantity - current.length }, makeAttendee)];
  return { ...attendeesByDay, [day]: nextRows };
}

/**
 * Flattens `attendeesByDay` into the SAME row order `CartAttendeeFields` renders and
 * `expandAttendeesByDayToLineItems` expands — `showDays` order (chronological), NEVER
 * `Object.entries(attendeesByDay)` order (interaction order). This is the single
 * chronological-ordering authority both the render path and the submit path must share.
 */
export function flattenAttendeesByDay(attendeesByDay: AttendeesByDay, showDays: string[]): CartAttendee[] {
  return showDays.flatMap((day) => attendeesByDay[day] ?? []);
}

/**
 * Maps a flat row index (the `i`-th panel `CartAttendeeFields` renders, 0-indexed, in
 * `flattenAttendeesByDay` order) back to which day's array — and which local index within
 * it — that panel belongs to. Returns `null` for an out-of-range index (defensive; should
 * not happen if the caller only passes indices `CartAttendeeFields` actually rendered).
 */
export function locateFlatAttendeeIndex(
  attendeesByDay: AttendeesByDay,
  showDays: string[],
  flatIndex: number
): { day: string; localIndex: number } | null {
  let remaining = flatIndex;
  for (const day of showDays) {
    const rows = attendeesByDay[day] ?? [];
    if (remaining < rows.length) return { day, localIndex: remaining };
    remaining -= rows.length;
  }
  return null;
}

/**
 * Writes one field on one attendee row, addressed by FLAT index (the index
 * `CartAttendeeFields`'s `onAttendeeChange` callback reports), by first resolving it to
 * (day, localIndex) via `locateFlatAttendeeIndex` and updating only that day's array. A
 * no-op (returns `attendeesByDay` unchanged) if the index doesn't resolve.
 */
export function updateAttendeeFieldByFlatIndex(
  attendeesByDay: AttendeesByDay,
  showDays: string[],
  flatIndex: number,
  field: keyof CartAttendee,
  value: string
): AttendeesByDay {
  const loc = locateFlatAttendeeIndex(attendeesByDay, showDays, flatIndex);
  if (!loc) return attendeesByDay;
  const rows = attendeesByDay[loc.day] ?? [];
  const nextRows = rows.map((row, i) => (i === loc.localIndex ? { ...row, [field]: value } : row));
  return { ...attendeesByDay, [loc.day]: nextRows };
}

/**
 * Expands `attendeesByDay` into a flat, ORDERED array of line items — `showDays` order,
 * NOT `Object.entries()` order (the bug the second correction fixes). Each day's own
 * quantity is that day's own array length, so there is no separate quantity value that
 * could disagree with the row count.
 */
export function expandAttendeesByDayToLineItems(input: {
  ticketType: string;
  attendeesByDay: AttendeesByDay;
  showDays: string[];
}): { ticketType: string; attendeeName: string; attendeeEmail: string; chosenDay: string }[] {
  const lineItems: { ticketType: string; attendeeName: string; attendeeEmail: string; chosenDay: string }[] = [];
  for (const day of input.showDays) {
    const rows = input.attendeesByDay[day] ?? [];
    for (const attendee of rows) {
      lineItems.push({
        ticketType: input.ticketType,
        attendeeName: attendee.attendeeName,
        attendeeEmail: attendee.attendeeEmail,
        chosenDay: day,
      });
    }
  }
  return lineItems;
}
