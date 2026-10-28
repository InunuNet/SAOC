// =============================================================
// SAOC — lib/sast-date.ts
// One notion of "today" for the events lists: the South African calendar day (Africa/Johannesburg,
// UTC+2, no daylight saving). The UTC date lags it by two hours every night.
// =============================================================

import { fixtureNow } from './fixture-clock.ts';

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
 * `dateTime(coalesce(endDate, date)) >= dateTime($todayStart)`. GROQ's now() is deliberately not used, so the real
 * events and the preview placeholders share this one notion of "today". `todayDate` serves the date-only branch:
 * GROQ's dateTime() is null for a date-only value, which the query compares as a string against the SAST date.
 */
export function upcomingEventsParams(now: Date = fixtureNow() ?? new Date()): { todayStart: string; todayDate: string } {
  return { todayStart: sastStartOfDay(now), todayDate: sastDate(now) };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The upcoming-events filter, mirrored in JS for the unit check; compares instants, so offset and
 * no-millisecond values sort correctly. A date-only value is the SAST calendar date and stays listed
 * for that whole SAST day. (Sanity datetime fields cannot hold one, and GROQ's dateTime() returns null
 * for it, so the query side leaves it out.)
 */
export function isUpcoming(event: { date: string; endDate?: string | null }, now: Date): boolean {
  const last = event.endDate ?? event.date;
  if (DATE_ONLY.test(last)) return last >= sastDate(now);
  return Date.parse(last) >= Date.parse(sastStartOfDay(now));
}
