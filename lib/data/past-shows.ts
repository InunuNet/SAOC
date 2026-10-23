// =============================================================
// NOS — lib/data/past-shows.ts
// Pure half of the "Past shows" visibility rule (mission nos-archive-public-r64). Kept free of
// next/* and the Sanity client so a script can import it. The async half, which reads the
// dataset and the public/preview switch, is lib/data/past-shows-public.ts.
// =============================================================

import type { NavItem } from '@/components/chrome/nav-config';
import { mergePastShows, type SanityShowProjection } from '@/lib/data/mergeShows';

export const PAST_SHOWS_HREF = '/national-show/archive';

/**
 * True when the same record set the archive pages render holds at least one past show with a
 * recorded fact (venue, entries, exhibitors or awards). A year and a title alone are a label,
 * not a record.
 */
export function hasPastShowRecords(shows: SanityShowProjection[] | null | undefined): boolean {
  return mergePastShows(shows).some(
    (show) =>
      Boolean(show.venue?.trim()) ||
      (show.entries ?? 0) > 0 ||
      (show.exhibitors ?? 0) > 0 ||
      (show.awards ?? 0) > 0
  );
}

/** A copy of the nav without any leaf (or rail destination) that links to `href`. Never mutates. */
export function navWithoutHref(nav: readonly NavItem[], href: string): NavItem[] {
  const keep = <T extends { href: string }>(links: readonly T[]): T[] =>
    links.filter((link) => link.href !== href);
  return nav.map((item) => {
    if (item.type !== 'mega') return item;
    return {
      ...item,
      lead: item.lead && {
        ...item.lead,
        theShow: { ...item.lead.theShow, links: keep(item.lead.theShow.links) },
      },
      columns: item.columns.map((column) => ({ ...column, links: keep(column.links) })),
      featureRail: item.featureRail && {
        ...item.featureRail,
        destinations: keep(item.featureRail.destinations),
      },
    };
  });
}
