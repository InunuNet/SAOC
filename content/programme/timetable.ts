// The /programme timetable board. Heading, date line and opening hours are What to Expect v1.0,
// Section 2 ("Show dates – for public entrance"), word for word (Drive: Docs for Brad / National
// Show / What to Expect). The day numerals follow her date line. Sessions are not written here: they
// are placed on their day from each ticket product's own date (lib/data/ticket-presentation.ts).

export interface ShowDay {
  weekday: string;
  day: string;
  month: string;
  /** Her opening-hours text for the day. */
  hours: string;
}

export const TIMETABLE_HEADING = 'Show dates – for public entrance';
export const TIMETABLE_DATE_LINE = 'Thursday 23 to Sunday 26 September 2027';
export const OPENING_HOURS_LABEL = 'Opening hours';
export const TICKETS_HEADING = 'Tickets';

export const SHOW_DAYS: readonly ShowDay[] = [
  { weekday: 'Thursday', day: '23', month: 'September', hours: 'VIP Ticket Holders – 14.00 to 19.00' },
  { weekday: 'Friday', day: '24', month: 'September', hours: '9.00 to 17.00' },
  { weekday: 'Saturday', day: '25', month: 'September', hours: '9.00 to 17.00' },
  { weekday: 'Sunday', day: '26', month: 'September', hours: '9.00 to 16.00' },
];
