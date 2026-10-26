const CRLF = '\r\n';
// RFC 5545 section 3.1: a content line is at most 75 octets; a continuation line spends one on its space.
const MAX_LINE_OCTETS = 75;

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
    .replace(/\r\n|\r|\n/g, '\\n');
}

// Folds one content line on UTF-8 octets, breaking only between code points.
function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let currentOctets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const octets = Buffer.byteLength(char, 'utf8');
    if (currentOctets + octets > limit) {
      parts.push(current);
      current = '';
      currentOctets = 0;
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    currentOctets += octets;
  }
  parts.push(current);
  return parts.join(CRLF + ' ');
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const SAST_OFFSET_HOURS = 2;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type BoundaryKind = 'utc' | 'sast';

// Which day boundary an instant sits exactly on: midnight UTC, midnight SAST (22:00Z), or neither.
function boundaryKind(ms: number): BoundaryKind | null {
  const sinceMidnightUtc = ((ms % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
  if (sinceMidnightUtc === 0) return 'utc';
  if (sinceMidnightUtc === (24 - SAST_OFFSET_HOURS) * MS_PER_HOUR) return 'sast';
  return null;
}

// Calendar date of a boundary instant, as UTC-midnight ms. A SAST midnight falls on the next UTC day.
function calendarDay(ms: number, kind: BoundaryKind): number {
  return kind === 'sast' ? ms + SAST_OFFSET_HOURS * MS_PER_HOUR : ms;
}

function toIcsDateOnly(dayMs: number): string {
  return toIcsDate(new Date(dayMs).toISOString()).slice(0, 8);
}

// First and last calendar day of an all-day event, or null when the event is timed. All-day only
// when the start is date-only, or start and end sit on the same boundary kind a whole number of
// days (at least one) apart. A lone midnight is a real timed instant, not an all-day marker.
function allDayRange(input: IcsEventInput): { first: number; last: number } | null {
  const { start, end } = input;
  if (DATE_ONLY.test(start)) {
    const first = Date.parse(`${start}T00:00:00Z`);
    if (!end) return { first, last: first };
    if (!DATE_ONLY.test(end)) return null;
    const last = Date.parse(`${end}T00:00:00Z`);
    return { first, last: last > first ? last : first };
  }
  if (!end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  const kind = boundaryKind(startMs);
  if (kind === null || kind !== boundaryKind(endMs)) return null;
  const span = endMs - startMs;
  if (span < MS_PER_DAY || span % MS_PER_DAY !== 0) return null;
  return { first: calendarDay(startMs, kind), last: calendarDay(endMs, kind) };
}

// DTSTART and DTEND lines. RFC 5545 section 3.6.1: an all-day event is VALUE=DATE with an
// exclusive DTEND, the day after the last day.
function buildDateLines(input: IcsEventInput): string[] {
  const range = allDayRange(input);
  if (range === null) {
    const lines = [`DTSTART:${toIcsDate(input.start)}`];
    if (input.end) lines.push(`DTEND:${toIcsDate(input.end)}`);
    return lines;
  }
  return [
    `DTSTART;VALUE=DATE:${toIcsDateOnly(range.first)}`,
    `DTEND;VALUE=DATE:${toIcsDateOnly(range.last + MS_PER_DAY)}`,
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

  return lines.map(foldLine).join(CRLF);
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
