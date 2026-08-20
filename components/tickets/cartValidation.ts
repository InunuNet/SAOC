// F2 (ticketing-multi-line-item-cart-ui) — small validation/init helpers for the cart
// attendee rows. Split out of useTicketCart.ts to keep it under the project's 150-line
// component-size convention.
import type { CartAttendee } from '@/lib/cart';
import { attendeeRowKey, type AttendeeFieldErrors } from '@/components/tickets/CartAttendeeFields';
import { dayPickerRowKey, type DayPickerErrors } from '@/components/tickets/CartDayPicker';
import type { TicketTypeCardData } from '@/components/tickets/TicketTypeCard';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyAttendee(): CartAttendee {
  return { attendeeName: '', attendeeEmail: '' };
}

// F5 (ticketing-f5-day-attendees) — client-side UX check only; the server's per-line-item
// pass (app/api/tickets/checkout/route.ts) is the real, authoritative gate.
export function validateChosenDays(
  ticketTypes: TicketTypeCardData[],
  quantities: Record<string, number>,
  chosenDayByType: Record<string, string[]>
): DayPickerErrors {
  const errors: DayPickerErrors = {};
  for (const type of ticketTypes) {
    if (!type.requiresDaySelection) continue;
    if ((quantities[type.slug] ?? 0) <= 0) continue;
    const rows = chosenDayByType[type.slug] ?? [];
    rows.forEach((value, index) => {
      if (value.trim().length === 0) {
        errors[dayPickerRowKey(type.slug, index)] = 'Please select a day.';
      }
    });
  }
  return errors;
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
