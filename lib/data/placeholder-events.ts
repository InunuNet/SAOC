// =============================================================
// SAOC — lib/data/placeholder-events.ts
// AI-INVENTED EVENTS, kept on purpose and shown on the beta preview only.
//
// Brad, verbatim: "If we have invented events, then just keep the invented events in and then note
// them as AI events waiting on SAOC's official events to populate the page."
//
// These 17 entries are the invented calendar that lib/data/events.ts held before commit b45971b0
// removed it (restored from b45971b0^). They are NOT Council-supplied. Rules that keep them honest:
//   - /events is the only reader (app/(marketing)/events/page.tsx), and only while
//     withholdPlaceholderProse() is false (SHOW_PLACEHOLDER_PREVIEW with the beta wall up).
//   - Each row carries the PlaceholderMarker and is never a link.
//   - Nothing machine-readable reads this module: no JSON-LD Event node, sitemap, .ics feed, event
//     slug page, llms file or other events list. scripts/checks/events-placeholders-static.mjs fails
//     the build gate if one of those files imports it.
//   - Nothing is written to Sanity; the real events stay the source of truth.
// =============================================================

import type { SanityEvent, SocietyEvent } from '@/types';

/** The row /events renders for an invented event: a SanityEvent with no slug (so never a link) and the flag. */
export type PlaceholderEventRow = SanityEvent & { isPlaceholder: true };

export const placeholderEvents: SocietyEvent[] = [
  {
    id: 0,
    date: '2026-03-15',
    endDate: '2026-03-15',
    title: 'Cape Orchid Society Autumn Show',
    host: 'Cape Orchid Society',
    venue: 'Kirstenbosch Hall, Cape Town',
    kind: 'Show',
    province: 'WC',
  },
  {
    id: -1,
    date: '2026-04-05',
    endDate: '2026-04-05',
    title: 'Transvaal Autumn Orchid Show',
    host: 'Transvaal Orchid Society',
    venue: 'Walter Sisulu NBG, Roodepoort',
    kind: 'Show',
    province: 'GP',
  },
  {
    id: -2,
    date: '2026-05-10',
    title: 'Judging Workshop — Paphiopedilum',
    host: 'SAOC Judging',
    venue: 'Pretoria NBG',
    kind: 'Workshop',
    province: 'GP',
  },
  {
    id: 1,
    date: '2026-07-11',
    endDate: '2026-07-12',
    title: 'Cape Orchid Society Winter Show',
    host: 'Cape Orchid Society',
    venue: 'Kirstenbosch Hall, Cape Town',
    kind: 'Show',
    province: 'WC',
  },
  {
    id: 2,
    date: '2026-07-25',
    endDate: '2026-07-26',
    title: 'Natal Winter Orchid Show',
    host: 'Natal Orchid Society',
    venue: 'Durban Botanic Gardens',
    kind: 'Show',
    province: 'KZN',
  },
  {
    id: 3,
    date: '2026-08-01',
    title: 'SAOC Council AGM 2026',
    host: 'SAOC',
    venue: 'Bloemfontein Civic Centre',
    kind: 'Council',
    province: 'FS',
  },
  {
    id: 4,
    date: '2026-08-15',
    endDate: '2026-08-16',
    title: 'Transvaal Spring Orchid Show',
    host: 'Transvaal Orchid Society',
    venue: 'Walter Sisulu NBG, Roodepoort',
    kind: 'Show',
    province: 'GP',
  },
  {
    id: 5,
    date: '2026-08-22',
    title: 'Judging Workshop — Cattleya Alliance',
    host: 'SAOC Judging',
    venue: 'Pretoria NBG',
    kind: 'Workshop',
    province: 'GP',
  },
  {
    id: 6,
    date: '2026-09-05',
    endDate: '2026-09-06',
    title: 'Cape Spring Orchid Show',
    host: 'Cape Orchid Society',
    venue: 'Kirstenbosch Hall',
    kind: 'Show',
    province: 'WC',
  },
  {
    id: 7,
    date: '2026-09-19',
    endDate: '2026-09-20',
    title: 'Northern Transvaal Spring Show',
    host: 'N. Transvaal Orchid Society',
    venue: 'Pretoria NBG',
    kind: 'Show',
    province: 'GP',
  },
  {
    id: 8,
    date: '2026-09-26',
    endDate: '2026-09-27',
    title: 'Eastern Province Spring Show',
    host: 'EP Orchid Society',
    venue: 'NMBay Botanical Gardens',
    kind: 'Show',
    province: 'EC',
  },
  {
    id: 9,
    date: '2026-10-03',
    endDate: '2026-10-04',
    title: 'Lowveld Spring Orchid Show',
    host: 'Lowveld Orchid Society',
    venue: 'Lowveld NBG, Mbombela',
    kind: 'Show',
    province: 'MP',
  },
  {
    id: 10,
    date: '2026-10-17',
    endDate: '2026-10-18',
    title: 'Midlands Orchid Show',
    host: 'Midlands Orchid Society',
    venue: 'Royal Agricultural Society Hall, PMB',
    kind: 'Show',
    province: 'KZN',
  },
  {
    id: 11,
    date: '2026-11-07',
    endDate: '2026-11-08',
    title: 'East Rand Cymbidium Show',
    host: 'East Rand Orchid Society',
    venue: 'Benoni Country Club',
    kind: 'Show',
    province: 'GP',
  },
  {
    id: 12,
    date: '2026-11-21',
    title: 'Hybridisation Symposium 2026',
    host: 'SAOC',
    venue: 'Stellenbosch University',
    kind: 'Workshop',
    province: 'WC',
  },
  {
    id: 13,
    date: '2027-02-20',
    endDate: '2027-02-21',
    title: 'Summer Species Show',
    host: 'Winelands Orchid Society',
    venue: 'Stellenbosch University BG',
    kind: 'Show',
    province: 'WC',
  },
  {
    id: 14,
    date: '2027-03-06',
    title: 'Judging Accreditation Exam — Round 1',
    host: 'SAOC Judging',
    venue: 'Regional Centres',
    kind: 'Council',
    province: 'GP',
  },
];

const PLACEHOLDER_ID_PREFIX = 'placeholder-';
const ISO_DATE_LENGTH = 10;

const TITLE_WORD = /[a-z0-9]+/g;

function titleWords(title: string): Set<string> {
  return new Set(title.toLowerCase().match(TITLE_WORD) ?? []);
}

// A real event always wins: same start date, and every word of the shorter title is in the longer one.
function duplicatesRealEvent(event: SocietyEvent, realEvents: readonly SanityEvent[]): boolean {
  const words = titleWords(event.title);
  return realEvents.some((real) => {
    if (real.date.slice(0, ISO_DATE_LENGTH) !== event.date) return false;
    const realWords = titleWords(real.title);
    const [small, large] = words.size <= realWords.size ? [words, realWords] : [realWords, words];
    return [...small].every((word) => large.has(word));
  });
}

/** The invented events dated today or later and not duplicating a real event, as /events rows, oldest first. */
export function upcomingPlaceholderEvents(
  today: Date,
  realEvents: readonly SanityEvent[] = [],
): PlaceholderEventRow[] {
  const todayIso = today.toISOString().slice(0, ISO_DATE_LENGTH);
  return placeholderEvents
    .filter((event) => (event.endDate ?? event.date) >= todayIso)
    .filter((event) => !duplicatesRealEvent(event, realEvents))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => ({
      _id: `${PLACEHOLDER_ID_PREFIX}${Math.abs(event.id)}-${event.date}`,
      title: event.title,
      slug: '',
      date: event.date,
      endDate: event.endDate ?? null,
      kind: event.kind,
      venue: event.venue,
      hostSociety: { _id: `${PLACEHOLDER_ID_PREFIX}host`, name: event.host, slug: '' },
      isFeatured: false,
      isPlaceholder: true,
    }));
}
