import { formatShowDay } from '@/lib/show-day-format';

/**
 * ticket-pdf (D11) — which date a ticket prints, decided from the ticket type's own data and
 * never invented. A buyer-chosen day prints that day, a show-span admission prints the show's
 * date range exactly as Sanity gives it, and everything else (conference, field trip, unknown
 * category) is unconfirmed, which renders the "To be confirmed" pill.
 */

export interface TicketTypeTraits {
  category?: string | null;
  requiresDaySelection?: boolean | null;
}

export type TicketScheduleKind = 'show-span' | 'chosen-day' | 'unconfirmed';

export interface ResolvedTicketSchedule {
  kind: TicketScheduleKind;
  dateText: string | null;
}

const ADMISSION_CATEGORY = 'admission';
const UNCONFIRMED: ResolvedTicketSchedule = { kind: 'unconfirmed', dateText: null };

export function resolveTicketSchedule(
  type: TicketTypeTraits,
  chosenDay: string | null,
  showRange: string | null
): ResolvedTicketSchedule {
  if (type.requiresDaySelection === true) {
    const dateText = chosenDay ? formatShowDay(chosenDay) : null;
    return dateText ? { kind: 'chosen-day', dateText } : UNCONFIRMED;
  }
  if (type.category === ADMISSION_CATEGORY && showRange) {
    return { kind: 'show-span', dateText: showRange };
  }
  return UNCONFIRMED;
}
