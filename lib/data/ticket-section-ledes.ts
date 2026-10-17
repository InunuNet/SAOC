// =============================================================
// NOS — lib/data/ticket-section-ledes.ts
// The one-line scope under each tickets-hub section title (goldens/f18b v13-copy.json
// "sectionLedes"). Wording is the mock's; every fact is interpolated from a real source: the show
// dates from the nationalShow singleton (R24) and the product names from the CMS. A line whose
// fact cannot be sourced is null, and the page renders no node for it. No date is typed here.
// =============================================================

export interface SectionLedeInput {
  /** nationalShow.showDate, an ISO date (YYYY-MM-DD) or null. */
  showDate: string | null;
  /** nationalShow.showEndDate, an ISO date or null. */
  showEndDate: string | null;
  /** Which products have a card on the page. */
  has: {
    vip: boolean;
    sunset: boolean;
    symposium: boolean;
    wosa: boolean;
    workshops: boolean;
  };
  /** CMS names of the programme cards. */
  names: {
    symposium: string | null;
    wosa: string | null;
    workshops: string | null;
  };
}

export interface SectionLedes {
  thursday: string | null;
  passes: string | null;
  programme: string | null;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const MS_PER_DAY = 86_400_000;
const THURSDAY = 4;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface CalendarDate {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

// Calendar arithmetic in UTC, so the weekday never depends on the machine's time zone.
function parseDate(iso: string | null): CalendarDate | null {
  const match = iso ? ISO_DATE.exec(iso) : null;
  if (!match) return null;
  const at = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return {
    year: at.getUTCFullYear(),
    month: at.getUTCMonth(),
    day: at.getUTCDate(),
    weekday: at.getUTCDay(),
  };
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const at = new Date(Date.UTC(date.year, date.month, date.day) + days * MS_PER_DAY);
  return {
    year: at.getUTCFullYear(),
    month: at.getUTCMonth(),
    day: at.getUTCDate(),
    weekday: at.getUTCDay(),
  };
}

function dayKey(date: CalendarDate): number {
  return Date.UTC(date.year, date.month, date.day);
}

function thursdayLede(input: SectionLedeInput): string | null {
  const start = parseDate(input.showDate);
  if (!start || start.weekday !== THURSDAY) return null;
  if (!input.has.vip || !input.has.sunset) return null;
  return `Two evening events on Thursday ${start.day} ${MONTHS[start.month]}.`;
}

function passesLede(input: SectionLedeInput): string | null {
  const show = parseDate(input.showDate);
  const end = parseDate(input.showEndDate);
  if (!show || !end) return null;
  const first = addDays(show, 1);
  if (dayKey(first) > dayKey(end)) return null;
  if (show.year !== end.year || show.month !== end.month) return null;
  return `${WEEKDAYS[first.weekday]} ${first.day} to ${WEEKDAYS[end.weekday]} ${end.day} ${
    MONTHS[end.month]
  }.`;
}

function programmeLede(input: SectionLedeInput): string | null {
  const { has, names } = input;
  if (!has.symposium || !has.wosa || !has.workshops) return null;
  if (!names.symposium || !names.wosa || !names.workshops) return null;
  return `The ${names.symposium}, the ${names.wosa} and ${names.workshops.toLowerCase()}.`;
}

export function buildSectionLedes(input: SectionLedeInput): SectionLedes {
  return {
    thursday: thursdayLede(input),
    passes: passesLede(input),
    programme: programmeLede(input),
  };
}
