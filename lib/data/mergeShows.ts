// =============================================================
// SAOC — lib/data/mergeShows.ts
// Union-on-year merge of the static show record and the Sanity `show` documents.
//
// Neither source is a superset of the other. `lib/data/shows` carries seven fields the
// `show` schema cannot express (edition, month, host, days, visitors, trophies, note);
// Sanity owns title, exhibitors and awards, and is authoritative for year, status,
// venue and entries. Replacing one with the other loses data — which is why both
// archive pages read this helper rather than either source directly.
//
// Precedence rule: a DEFINED Sanity value wins; otherwise the static value; otherwise
// undefined. Never the reverse — a published edit must not be masked by a literal.
// See .agent/memory/project/specs/cms-wiring-cleanup/goldens/archive-show-merge.golden.md
// =============================================================

import { shows as staticShows } from '@/lib/data/shows';
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
 * A merged archive record. `edition`, `month`, `host` and `venue` are required on
 * `NationalShow` because every static entry has them — but a Sanity-only year has no
 * static counterpart to supply them, so they are optional here and the pages degrade.
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

/**
 * Merges the static array with the supplied Sanity documents, keyed on year, and
 * returns the result newest-first.
 */
export function mergeShows(sanityShows: SanityShowProjection[] | null | undefined): ArchiveShow[] {
  const byYear = new Map<number, ArchiveShow>();

  for (const entry of staticShows) {
    byYear.set(entry.year, { ...entry });
  }

  for (const doc of sanityShows ?? []) {
    if (typeof doc?.year !== 'number') continue;
    // A Sanity-only year has no static base: it starts empty and degrades in the UI.
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
