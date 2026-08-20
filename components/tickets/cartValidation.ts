// F2 (ticketing-multi-line-item-cart-ui) — small validation/init helpers for the cart
// attendee rows. Split out of useTicketCart.ts to keep it under the project's 150-line
// component-size convention.
import type { CartAttendee } from '@/lib/cart';
import { attendeeRowKey, type AttendeeFieldErrors } from '@/components/tickets/CartAttendeeFields';
import type { TicketTypeCardData } from '@/components/tickets/TicketTypeCard';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyAttendee(): CartAttendee {
  return { attendeeName: '', attendeeEmail: '' };
}

/** Validates every attendee row currently in the cart. Returns per-row field errors,
 *  keyed the same way CartAttendeeFields expects. */
export function validateAttendees(
  ticketTypes: TicketTypeCardData[],
  quantities: Record<string, number>,
  attendeesByType: Record<string, CartAttendee[]>
): AttendeeFieldErrors {
  const errors: AttendeeFieldErrors = {};
  for (const type of ticketTypes) {
    const rows = attendeesByType[type.slug] ?? [];
    if ((quantities[type.slug] ?? 0) <= 0) continue;
    rows.forEach((row, index) => {
      const rowErrors: { name?: string; email?: string } = {};
      if (row.attendeeName.trim().length === 0) rowErrors.name = 'Please enter the attendee name.';
      if (!EMAIL_PATTERN.test(row.attendeeEmail)) rowErrors.email = 'Please enter a valid email address.';
      if (rowErrors.name || rowErrors.email) errors[attendeeRowKey(type.slug, index)] = rowErrors;
    });
  }
  return errors;
}
