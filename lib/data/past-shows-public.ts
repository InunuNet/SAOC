// =============================================================
// NOS — lib/data/past-shows-public.ts
// Mission nos-archive-public-r64. In a public build /national-show/archive and every link to it
// are withheld until the Sanity `show` documents hold a past show with a recorded fact; a
// preview build keeps the route. "Until records exist" is read from the dataset the archive
// pages already render, never a flag. See docs/nos-archive-public-r64.md.
// =============================================================

import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import type { NavItem } from '@/components/chrome/nav-config';
import type { SanityShowProjection } from '@/lib/data/mergeShows';
import { PAST_SHOWS_HREF, hasPastShowRecords, navWithoutHref } from '@/lib/data/past-shows';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { sanityFetch } from '@/sanity/lib/fetch';
import { pastShowsQuery } from '@/sanity/queries';

/** True when the Past shows route and its links are shown: always in preview, in public once records exist. */
export async function showPastShowsRoute(): Promise<boolean> {
  if (!withholdPlaceholderProse()) return true;
  const shows = await sanityFetch<SanityShowProjection[]>({
    query: pastShowsQuery,
    tags: ['show', 'sanity'],
  });
  return hasPastShowRecords(shows);
}

/** The show nav every NOS chrome and sub-nav surface renders: NOS_NAV, minus the Past shows leaf while the route is withheld. */
export async function getVisibleNav(): Promise<readonly NavItem[]> {
  return (await showPastShowsRoute()) ? NOS_NAV : navWithoutHref(NOS_NAV, PAST_SHOWS_HREF);
}
