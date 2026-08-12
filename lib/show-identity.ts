// =============================================================
// SAOC — lib/show-identity.ts
// Formatting helpers for show-identity facts (edition, dates, venue).
//
// Extracted from app/(marketing)/national-show/page.tsx in round 2 of the
// show-visitor-info mission: seven surfaces now render these facts from the
// nationalShow singleton, and seven copies of the same Intl call is how the
// site ended up advertising two different venues in one viewport.
//
// See contracts/golden/show-visitor-info/show-identity-surfaces.golden.md.
// =============================================================

// Fixed to the show's own timezone so a rendered date does not shift with the
// server's locale — a date that changes between environments is a bug.
const SHOW_DATE_ZONE = 'Africa/Johannesburg';

const LOCALE = 'en-ZA';

/** `18–21 September 2027`, or a single long date when there is no end date. */
export function formatShowDateRange(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const from = new Date(start);
  if (Number.isNaN(from.getTime())) return null;

  const long = new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: SHOW_DATE_ZONE,
  });
  if (!end) return long.format(from);

  const to = new Date(end);
  if (Number.isNaN(to.getTime())) return long.format(from);

  const day = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: SHOW_DATE_ZONE });
  return `${day.format(from)}–${long.format(to)}`;
}

/** `September 2027`. */
export function formatShowMonthYear(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: SHOW_DATE_ZONE,
  }).format(date);
}

/** `Sep 2027` — the compact form the home nav card and utility bar use. */
export function formatShowShortMonthYear(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(LOCALE, {
    month: 'short',
    year: 'numeric',
    timeZone: SHOW_DATE_ZONE,
  }).format(date);
}

/** Calendar year of a show-identity date, in the show's own timezone. */
export function showYearOf(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = new Intl.DateTimeFormat(LOCALE, {
    year: 'numeric',
    timeZone: SHOW_DATE_ZONE,
  }).format(date);
  return Number(year);
}

/** `19` → `19th`. */
export function toOrdinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/**
 * `19th National Show` — no leading article, for CTA labels and aria-labels. Falls back
 * to the edition-free wording rather than inventing a number: when a show-identity fact
 * is absent we render the absence, per show-identity-surfaces.golden.md.
 */
export function showLabelWithEdition(edition?: number | null, noun = 'National Show'): string {
  return edition ? `${toOrdinal(edition)} ${noun}` : noun;
}

/** `The 19th National Orchid Show` — the sentence form of {@link showLabelWithEdition}. */
export function showTitleWithEdition(edition?: number | null, noun = 'National Orchid Show'): string {
  return `The ${showLabelWithEdition(edition, noun)}`;
}
