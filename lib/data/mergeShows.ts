// =============================================================
// SAOC — lib/data/mergeShows.ts
// Builds the archive record set from the Sanity `show` documents, keyed on year.
//
// The former static seed record was invented design-mock data with no
// committee source and has been removed (mission launch-weekend F6, docs/rules/no-invention.md).
// A Sanity-only year has no edition, month, host, days, visitors or trophies, so those
// fields stay undefined and the pages degrade rather than invent them.
// See .agent/memory/project/specs/launch-weekend/goldens/f6/f6-spec.md
// =============================================================

import type { NationalShow } from '@/types';

/** A `show` document as projected by `pastShowsQuery`. */
export interface SanityShowProjection {
  _id?: string;
  title?: string | null;
  slug?: string | null;
  year?: number | null;
  status?: string | null;
  location?: string | null;
  entries?: number | null;
  exhibitors?: number | null;
  awards?: number | null;
}

/**
 * An archive record. `edition`, `month`, `host` and `venue` are required on
 * `NationalShow`, but a Sanity-only year does not carry them, so they are optional
 * here and the pages degrade.
 */
export type ArchiveShow = Omit<NationalShow, 'edition' | 'month' | 'host' | 'venue'> & {
  edition?: number;
  month?: string;
  host?: string;
  venue?: string;
  title?: string;
  awards?: number;
};

/** Only the Sanity fields that actually hold a value, mapped onto archive field names. */
function definedFieldsOf(doc: SanityShowProjection): Partial<ArchiveShow> {
  const mapped: Partial<ArchiveShow> = {};
  if (typeof doc.year === 'number') mapped.year = doc.year;
  if (doc.status === 'past' || doc.status === 'upcoming') mapped.status = doc.status;
  // `location` is the venue string, not the host province.
  if (doc.location != null) mapped.venue = doc.location;
  if (doc.entries != null) mapped.entries = doc.entries;
  // Exhibitors get their own slot — they are not visitors.
  if (doc.exhibitors != null) mapped.exhibitors = doc.exhibitors;
  if (doc.awards != null) mapped.awards = doc.awards;
  if (doc.title != null) mapped.title = doc.title;
  return mapped;
}

/** Maps the supplied Sanity documents onto archive records, keyed on year, newest first. */
export function mergeShows(sanityShows: SanityShowProjection[] | null | undefined): ArchiveShow[] {
  const byYear = new Map<number, ArchiveShow>();

  for (const doc of sanityShows ?? []) {
    if (typeof doc?.year !== 'number') continue;
    const base: ArchiveShow = byYear.get(doc.year) ?? { year: doc.year, status: 'past' };
    byYear.set(doc.year, { ...base, ...definedFieldsOf(doc) });
  }

  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

/** The merged record set the archive pages show: past editions only, newest first. */
export function mergePastShows(
  sanityShows: SanityShowProjection[] | null | undefined,
): ArchiveShow[] {
  return mergeShows(sanityShows).filter((entry) => entry.status === 'past');
}
