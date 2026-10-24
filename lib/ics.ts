const CRLF = '\r\n';

export type IcsEventInput = {
  slug: string;
  title: string;
  start: string;
  end?: string | null;
  description?: string | null;
  venue?: string | null;
  location?: string | null;
};

export function toIcsDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    String(d.getUTCFullYear()) +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    'T' +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    'Z'
  );
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const SAST_OFFSET_HOURS = 2;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Calendar date (as UTC-midnight ms) of a stored value that sits on a day boundary: a date-only
// string, midnight UTC, or midnight SAST (22:00Z). Null for anything else, i.e. a timed value.
function allDayDate(iso: string): number | null {
  const ms = DATE_ONLY.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const sinceMidnightUtc = ((ms % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
  if (sinceMidnightUtc === 0) return ms;
  if (sinceMidnightUtc === (24 - SAST_OFFSET_HOURS) * MS_PER_HOUR) {
    return ms + SAST_OFFSET_HOURS * MS_PER_HOUR;
  }
  return null;
}

function toIcsDateOnly(dayMs: number): string {
  return toIcsDate(new Date(dayMs).toISOString()).slice(0, 8);
}

// DTSTART and DTEND lines. RFC 5545 section 3.6.1: an all-day event is VALUE=DATE with an
// exclusive DTEND, the day after the last day.
function buildDateLines(input: IcsEventInput): string[] {
  const startDay = allDayDate(input.start);
  const endDay = input.end ? allDayDate(input.end) : null;

  if (startDay === null || (input.end && endDay === null)) {
    const lines = [`DTSTART:${toIcsDate(input.start)}`];
    if (input.end) lines.push(`DTEND:${toIcsDate(input.end)}`);
    return lines;
  }

  const lastDay = endDay !== null && endDay > startDay ? endDay : startDay;
  return [
    `DTSTART;VALUE=DATE:${toIcsDateOnly(startDay)}`,
    `DTEND;VALUE=DATE:${toIcsDateOnly(lastDay + MS_PER_DAY)}`,
  ];
}

export function buildVEvent(input: IcsEventInput): string {
  const dtstamp = toIcsDate(new Date().toISOString());
  const locationParts = [input.venue, input.location].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : null;

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${input.slug}@saoc.co.za`,
    `DTSTAMP:${dtstamp}`,
    ...buildDateLines(input),
  ];

  lines.push(`SUMMARY:${escapeIcsText(input.title)}`);

  if (input.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  }

  if (locationStr) {
    lines.push(`LOCATION:${escapeIcsText(locationStr)}`);
  }

  lines.push('END:VEVENT');

  return lines.join(CRLF);
}

export function buildVCalendar(events: IcsEventInput[]): string {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SAOC//South African Orchid Council//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ].join(CRLF);

  const footer = 'END:VCALENDAR';
  const vevents = events.map(buildVEvent);

  return [header, ...vevents, footer].join(CRLF) + CRLF;
}
