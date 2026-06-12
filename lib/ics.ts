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

export function buildVEvent(input: IcsEventInput): string {
  const dtstamp = toIcsDate(new Date().toISOString());
  const locationParts = [input.venue, input.location].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : null;

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${input.slug}@saoc.co.za`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsDate(input.start)}`,
  ];

  if (input.end) {
    lines.push(`DTEND:${toIcsDate(input.end)}`);
  }

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
