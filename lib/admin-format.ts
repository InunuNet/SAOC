// Display formatting for admin tables. The time zone is explicit everywhere: Firestore stores
// UTC, the server may run in any zone, and a hydration mismatch or an off-by-two-hours date is
// worse than a slightly longer helper.

const ADMIN_TIME_ZONE = 'Africa/Johannesburg';
const ADMIN_LOCALE = 'en-ZA';
const EMPTY_VALUE = '—';

const DATE_FORMAT = new Intl.DateTimeFormat(ADMIN_LOCALE, {
  timeZone: ADMIN_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(ADMIN_LOCALE, {
  timeZone: ADMIN_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const CLOCK_FORMAT = new Intl.DateTimeFormat(ADMIN_LOCALE, {
  timeZone: ADMIN_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAdminDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? DATE_FORMAT.format(date) : EMPTY_VALUE;
}

export function formatAdminDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? DATE_TIME_FORMAT.format(date) : EMPTY_VALUE;
}

/** "hh:mm", 24-hour, Africa/Johannesburg. */
export function formatAdminClock(value: Date): string {
  return CLOCK_FORMAT.format(value);
}
