import type { Metadata } from 'next';

import { ShowSectionNav } from '@/components/show';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { NurseryCard, type NurseryCardData } from '@/components/show/nos/NurseryCard';
import { RealEmptyListing } from '@/components/show/nos/RealEmptyListing';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { sanityFetch } from '@/sanity/lib/fetch';
import { internationalNurseriesQuery } from '@/sanity/queries';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F14 (national-show-ia-alignment, M4) — created route. Placeholder prose plus a REAL
// empty listing over vendorNursery, filtered to guests outside South Africa. Zero
// invented guests — see route-manifest.golden.md §5.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// The nursery grid/RealEmptyListing is independent of the ShowPage, so it is passed as
// `listingContent` and rendered in the published branch only. See
// goldens/m4/never-404-fallback.golden.md.
export const revalidate = 60;

const CARD_FIELD_LABELS = ['Nursery / guest', 'Country', 'Specialisation', "What they'll bring"] as const;

const ABSENCE_STATEMENT =
  'No international guests or exhibitors have been confirmed for 2027 yet. Confirmed ' +
  'guests will appear here, one card per exhibitor, as they register ahead of the show.';

export const metadata: Metadata = buildPageMetadata({
  title: 'International Guests — National Orchid Show',
  description: 'International guests and exhibitors attending the National Orchid Show.',
  path: '/national-show/international-guests',
});

export default async function InternationalGuestsPage() {
  const [result, nurseries] = await Promise.all([
    loadShowPageOrFallback('05-international-guests-and-exhibitors', {
      label: 'International Guests',
      purpose: 'Public directory of international guests and exhibitors attending the show.',
    }),
    sanityFetch<NurseryCardData[]>({
      query: internationalNurseriesQuery,
      tags: ['vendorNursery', 'sanity'],
    }),
  ]);

  const list = nurseries ?? [];

  return (
    <>
      <ShowContentState
        result={result}
        heroImage="/images/orchid-purple.jpg"
        layout="listing"
        listingContent={
          list.length > 0 ? (
            <ShowEntityGrid
              items={list}
              itemKey={(nursery) => nursery._id}
              renderCard={(nursery) => <NurseryCard nursery={nursery} />}
            />
          ) : (
            <RealEmptyListing fieldLabels={CARD_FIELD_LABELS} absenceStatement={ABSENCE_STATEMENT} />
          )
        }
      />

      <ShowSectionNav current="/national-show/international-guests" />
    </>
  );
}
