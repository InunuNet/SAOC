// =============================================================
// SAOC — lib/show-day-format.ts
// South African English labels for a show day given as a calendar date (YYYY-MM-DD).
// The weekday is computed from the calendar date in UTC, never from the machine's zone, so
// "Thu 23 Sept 2027" reads the same on a server in any time zone. A value that is not a real
// calendar date comes back unchanged: a label function never throws on a bad day string.
// =============================================================

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// SA English abbreviates September as "Sept"; every other month is its three-letter form.
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
] as const;

interface CalendarDay {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

function parseCalendarDay(iso: string): CalendarDay | null {
  const match = ISO_DAY.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDate ? { year, month, day, weekday: date.getUTCDay() } : null;
}

/** "2027-09-23" -> "Thu 23 Sept 2027". */
export function formatShowDay(iso: string): string {
  const parsed = parseCalendarDay(iso);
  if (!parsed) return iso;
  return `${WEEKDAYS_SHORT[parsed.weekday]} ${parsed.day} ${MONTHS_SHORT[parsed.month - 1]} ${parsed.year}`;
}

/** "2027-09-24" -> "Fri 24" (the day-pass cell label). */
export function formatShowDayShort(iso: string): string {
  const parsed = parseCalendarDay(iso);
  if (!parsed) return iso;
  return `${WEEKDAYS_SHORT[parsed.weekday]} ${parsed.day}`;
}

/** "2027-09-24" -> { numeral: "24", caption: "Friday" } (the ticket stub for a chosen day). */
export function showDayStub(iso: string): { numeral: string; caption: string } | null {
  const parsed = parseCalendarDay(iso);
  if (!parsed) return null;
  return { numeral: String(parsed.day), caption: WEEKDAYS_LONG[parsed.weekday] };
}
