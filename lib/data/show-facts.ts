// =============================================================
// NOS — lib/data/show-facts.ts
// The show's headline facts (Dates, Host, Venue), built ONCE from the nationalShow
// singleton. The hub hero, the long-form template's aside and the holding state all read this
// module, so a fact can never read differently on two pages (F18, goldens/f18/f18-spec.md 3.1).
// Sanity wins in every fallback; the literals are only the right-hand side.
// =============================================================

import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { formatShowDateRange } from '@/lib/show-identity';
import type { ShowVenue } from '@/types';

export interface ShowFact {
  label: string;
  value: string;
}

export interface ShowFactsSource {
  showDate?: string | null;
  showEndDate?: string | null;
  hostRegion?: string | null;
  location?: string | null;
  venue?: ShowVenue | null;
}

export function buildShowFacts(show: ShowFactsSource | null | undefined): ShowFact[] {
  // S1: one fact, one field. `venue.name` is the source; the legacy `location` string is fallback only.
  const venueLine = show?.venue?.name || show?.location || 'Venue to be confirmed';
  const dateRange = formatShowDateRange(show?.showDate, show?.showEndDate);
  const hostRegion = show?.hostRegion || 'Host region to be confirmed';

  return [
    { label: 'Dates', value: dateRange ?? 'Dates to be confirmed' },
    { label: 'Host', value: hostRegion },
    { label: 'Venue', value: venueLine },
  ];
}

export async function loadShowFacts(): Promise<ShowFact[]> {
  const show = await sanityFetch<ShowFactsSource>({
    query: nationalShowQuery,
    tags: ['nationalShow', 'sanity'],
  });
  return buildShowFacts(show);
}
