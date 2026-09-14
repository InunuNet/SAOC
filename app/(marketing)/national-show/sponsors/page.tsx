import type { Metadata } from 'next';

import { ShowSectionNav } from '@/components/show';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { RealEmptyListing } from '@/components/show/nos/RealEmptyListing';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { ShowSponsorCard, type ShowSponsorCardData } from '@/components/show/nos/ShowSponsorCard';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showSponsorsQuery } from '@/sanity/queries';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F14 (national-show-ia-alignment, M4) — created route, reinstated by Brad. Its OWN data
// scope: showSponsor, never the site-level `sponsor` type site-level /sponsors reads —
// the two lists must be able to diverge. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md §6.
// Nothing here imports partnersQuery or references the site-level sponsor document
// type's GROQ filter (D51/SP2) — spelled out rather than quoted literally, because a
// comment containing the literal filter string is a false positive for that same check.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// The sponsor grid/RealEmptyListing is independent of the ShowPage, so it is passed as
// `listingContent` and rendered in the published branch only. See
// goldens/m4/never-404-fallback.golden.md.
export const revalidate = 60;

const CARD_FIELD_LABELS = ['Sponsor', 'Tier', 'Website'] as const;

const ABSENCE_STATEMENT =
  'No Show sponsors have been confirmed for 2027 yet. Confirmed sponsors will appear ' +
  'here, one card per sponsor, as the Council signs off each partnership ahead of the show.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Show Sponsors — National Orchid Show',
  description: "The National Show's own sponsors.",
  path: '/national-show/sponsors',
});

export default async function ShowSponsorsPage() {
  const [result, sponsors] = await Promise.all([
    loadShowPageOrFallback('15-sponsors', {
      label: 'Show Sponsors',
      purpose: "The Show's own sponsors — a separate list from SAOC's site-level sponsors.",
    }),
    sanityFetch<ShowSponsorCardData[]>({
      query: showSponsorsQuery,
      tags: ['showSponsor', 'sanity'],
    }),
  ]);

  const list = sponsors ?? [];

  return (
    <>
      <ShowContentState
        result={result}
        heroImage="/images/orchid-dark.jpg"
        layout="listing"
        listingContent={
          list.length > 0 ? (
            <ShowEntityGrid
              items={list}
              itemKey={(sponsor) => sponsor._id}
              renderCard={(sponsor) => <ShowSponsorCard sponsor={sponsor} />}
            />
          ) : (
            <RealEmptyListing fieldLabels={CARD_FIELD_LABELS} absenceStatement={ABSENCE_STATEMENT} />
          )
        }
      />

      <ShowSectionNav current="/national-show/sponsors" />
    </>
  );
}
