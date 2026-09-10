import type { Metadata } from 'next';

import { ShowSectionNav } from '@/components/show';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { NurseryCard, type NurseryCardData } from '@/components/show/nos/NurseryCard';
import { RealEmptyListing } from '@/components/show/nos/RealEmptyListing';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { sanityFetch } from '@/sanity/lib/fetch';
import { southAfricanNurseriesQuery } from '@/sanity/queries';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F14 (national-show-ia-alignment, M4) — created route. THE PUBLIC NURSERY DIRECTORY,
// distinct from /national-show/exhibitors (the grower entry guide — see D45/D46/X2) and
// from /national-show/vendors (the trade showcase, another lane's untouchable route).
// Zero nurseries is the correct output on day one — see route-manifest.golden.md §5. No
// nursery name is invented; an invented one is an invented commercial relationship with
// a real business.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// The nursery grid/RealEmptyListing is independent of the ShowPage, so it is passed as
// `listingContent` and rendered in the published branch only — an absent page shows the
// disclosure alone, never a listing alongside it. See goldens/m4/never-404-fallback.golden.md.
export const revalidate = 60;

const CARD_FIELD_LABELS = ['Nursery', 'Country', 'Specialisation', "What they'll bring"] as const;

const ABSENCE_STATEMENT =
  'No South African nurseries have been confirmed for the 2027 exhibitor pavilion yet. ' +
  'Confirmed exhibitors will appear here, one card per nursery, as they register ahead of the show.';

export const metadata: Metadata = buildPageMetadata({
  title: 'South African Exhibitors — National Orchid Show',
  description: 'The South African nurseries exhibiting at the National Orchid Show.',
  path: '/national-show/sa-exhibitors',
});

export default async function SouthAfricanExhibitorsPage() {
  const [result, nurseries] = await Promise.all([
    loadShowPageOrFallback('04-south-african-exhibitors', {
      label: 'South African Exhibitors',
      purpose: 'Public directory of South African nurseries exhibiting at the show.',
    }),
    sanityFetch<NurseryCardData[]>({
      query: southAfricanNurseriesQuery,
      tags: ['vendorNursery', 'sanity'],
    }),
  ]);

  const list = nurseries ?? [];

  return (
    <>
      <ShowContentState
        result={result}
        heroImage="/images/orchid-violet.jpg"
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

      <ShowSectionNav current="/national-show/sa-exhibitors" />
    </>
  );
}
