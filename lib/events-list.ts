// =============================================================
// SAOC — lib/events-list.ts
// Pure helpers for the /events list: featured split, month grouping, date block, controls gate.
// Erasable TypeScript with no path-alias imports, so the check scripts run it under Node type stripping.
// All calendar days are South African (Africa/Johannesburg), matching lib/sast-date.ts.
// =============================================================

/** Controls (kind chips, month select) only help once there is something to narrow. */
export const EVENT_CONTROLS_MIN = 6;

export const NATIONAL_SHOW_TITLE = /national.*show/i;

const SAST_TIME_ZONE = 'Africa/Johannesburg';
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_ABBREVIATION_LENGTH = 3;
const RANGE_DASH = '–';

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: SAST_TIME_ZONE });
const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('en-ZA', {
  month: 'long',
  year: 'numeric',
  timeZone: SAST_TIME_ZONE,
});
const MONTH_SHORT_FORMAT = new Intl.DateTimeFormat('en-ZA', {
  month: 'short',
  timeZone: SAST_TIME_ZONE,
});

export interface DatedEvent {
  date: string;
}

export interface ListableEvent extends DatedEvent {
  title?: string;
  isFeatured?: boolean | null;
  kind?: string | null;
}

export interface MonthBucket<T extends DatedEvent> {
  key: string;
  month: string;
  events: T[];
}

export interface DateBlock {
  d: string;
  m: string;
  y: string;
}

/** A Sanity date-only value is already a SAST calendar date; an instant is read in SAST. */
function sastDay(value: string): { year: string; month: string; day: string } {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) return { year: dateOnly[1], month: dateOnly[2], day: dateOnly[3] };
  const [year, month, day] = DAY_FORMAT.format(new Date(value)).split('-');
  return { year, month, day };
}

/** The instant used to name a month or its abbreviation: noon UTC of the SAST calendar day. */
function sastNoon(value: string): Date {
  const { year, month, day } = sastDay(value);
  return new Date(`${year}-${month}-${day}T12:00:00Z`);
}

export function showEventControls(count: number): boolean {
  return count >= EVENT_CONTROLS_MIN;
}

export function listSectionVisible(restCount: number): boolean {
  return restCount > 0;
}

export function isNationalShowEvent(event: { title?: string }): boolean {
  return NATIONAL_SHOW_TITLE.test(event.title ?? '');
}

/** The National Show (and any flagged event) leads the page in the band; the rest are listed. */
export function splitListed<T extends ListableEvent>(listed: T[]): { featured: T[]; rest: T[] } {
  const featured: T[] = [];
  const rest: T[] = [];
  for (const event of listed) {
    if (event.isFeatured === true || isNationalShowEvent(event)) featured.push(event);
    else rest.push(event);
  }
  return { featured, rest };
}

/** Group events by SAST calendar month, in the order they arrive (callers pass them date-sorted). */
export function groupByMonth<T extends DatedEvent>(events: T[]): MonthBucket<T>[] {
  const buckets = new Map<string, MonthBucket<T>>();
  for (const event of events) {
    const { year, month } = sastDay(event.date);
    const key = `${year}-${month}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.events.push(event);
    } else {
      buckets.set(key, {
        key,
        month: MONTH_LABEL_FORMAT.format(sastNoon(event.date)),
        events: [event],
      });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/** Three-letter uppercase month for a SAST calendar day. */
function shortMonth(value: string): string {
  return MONTH_SHORT_FORMAT.format(sastNoon(value))
    .slice(0, MONTH_ABBREVIATION_LENGTH)
    .toUpperCase();
}

/**
 * Day, MON and year for the row's date block. A multi-day event within one month shows `23–26`; one
 * that crosses a month shows `30` over `OCT – 2 NOV` (start day and month, end day and month).
 */
export function eventDateBlock(date: string, endDate?: string | null): DateBlock {
  const start = sastDay(date);
  const m = shortMonth(date);
  const day = String(Number(start.day));
  if (endDate) {
    const end = sastDay(endDate);
    const endDay = String(Number(end.day));
    if (end.year === start.year && end.month === start.month) {
      if (end.day !== start.day) return { d: `${day}${RANGE_DASH}${endDay}`, m, y: start.year };
    } else if (
      `${end.year}-${end.month}-${end.day}` > `${start.year}-${start.month}-${start.day}`
    ) {
      return { d: day, m: `${m} ${RANGE_DASH} ${endDay} ${shortMonth(endDate)}`, y: start.year };
    }
  }
  return { d: day, m, y: start.year };
}

/** Distinct non-empty kinds in first-seen order: chips come from the data, never invented. */
export function kindOptions(events: Array<{ kind?: string | null }>): string[] {
  const kinds: string[] = [];
  for (const event of events) {
    const kind = event.kind?.trim();
    if (kind && !kinds.includes(kind)) kinds.push(kind);
  }
  return kinds;
}
