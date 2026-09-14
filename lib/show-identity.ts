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

import type { ShowVenue } from '@/types';

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

/**
 * `2027-09-16` — a BARE calendar date in the show's own timezone, for schema.org.
 *
 * F18 wiring (nos-design-system, M6): Sanity stores `showDate`/`showEndDate` as `datetime`,
 * so the raw value carries a time-of-day. Google's Event guidance treats a midnight-stamped
 * date as a mistake, and the show is a multi-day event with no single meaningful instant, so
 * structured data must publish the bare date. Assembled from `formatToParts` rather than a
 * locale pattern so the output is `YYYY-MM-DD` regardless of the runtime's locale data.
 */
export function toShowIsoDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: SHOW_DATE_ZONE,
  }).formatToParts(date);

  const find = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const [year, month, day] = [find('year'), find('month'), find('day')];
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

/**
 * `Stellenbosch Airfield, R44, Stellenbosch, 7600, Western Cape` — the venue's postal
 * address on one line, composed in the SAME order components/show/VenueCard.tsx renders it
 * so the rendered address and the structured-data address can never disagree.
 *
 * Returns null when Sanity holds no address detail at all. The Event builder treats that as
 * a missing `location` and emits no node rather than an address-less Place — a venue is
 * never substituted or guessed.
 */
export function formatVenueAddress(venue?: ShowVenue | null): string | null {
  if (!venue) return null;
  const cityLine = [venue.city, venue.postalCode].filter(Boolean).join(', ');
  const parts = [...(venue.addressLines ?? []), cityLine, venue.province].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(', ') : null;
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
