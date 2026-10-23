// =============================================================
// SAOC — lib/sast-date.ts
// One notion of "today" for the events lists: the South African calendar day (Africa/Johannesburg,
// UTC+2, no daylight saving). The UTC date lags it by two hours every night.
// =============================================================

const SAST_TIME_ZONE = 'Africa/Johannesburg';
const SAST_UTC_OFFSET = '+02:00';
const SAST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: SAST_TIME_ZONE });

/** The calendar date (YYYY-MM-DD) in South Africa at `now`. */
export function sastDate(now: Date): string {
  return SAST_DATE_FORMAT.format(now);
}

/** The instant (UTC ISO string) at which the South African day containing `now` began. */
export function sastStartOfDay(now: Date): string {
  return new Date(`${sastDate(now)}T00:00:00${SAST_UTC_OFFSET}`).toISOString();
}

/**
 * Params for the upcoming-events GROQ queries. An event stays listed until its last day ends:
 * `coalesce(endDate, date) >= $todayStart`. GROQ's now() is deliberately not used, so the real
 * events and the preview placeholders share this one notion of "today".
 */
export function upcomingEventsParams(now: Date = new Date()): { todayStart: string } {
  return { todayStart: sastStartOfDay(now) };
}

/** The upcoming-events filter, mirrored in JS for the unit check. ISO UTC strings compare as text. */
export function isUpcoming(event: { date: string; endDate?: string | null }, now: Date): boolean {
  return (event.endDate ?? event.date) >= sastStartOfDay(now);
}
