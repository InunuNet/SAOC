import type { Metadata } from 'next';

import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { NurseryCard, type NurseryCardData } from '@/components/show/nos/NurseryCard';
import { RealEmptyListing } from '@/components/show/nos/RealEmptyListing';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { sanityFetch } from '@/sanity/lib/fetch';
import { internationalNurseriesQuery } from '@/sanity/queries';
import { loadShowFacts } from '@/lib/data/show-facts';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

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

const CARD_FIELD_LABELS = [
  'Nursery / guest',
  'Country',
  'Specialisation',
  "What they'll bring",
] as const;

const ABSENCE_STATEMENT =
  'No international guests or exhibitors have been confirmed for 2027 yet. Confirmed ' +
  'guests will appear here, one card per exhibitor, as they register ahead of the show.';

export const metadata: Metadata = buildPageMetadata({
  title: 'International Guests',
  image: nosOgImage('International Guests — National Orchid Show'),
  description: 'International guests and exhibitors attending the National Orchid Show.',
  path: '/national-show/international-guests',
});

export default async function InternationalGuestsPage() {
  const [result, nurseries, facts] = await Promise.all([
    loadShowPageOrFallback('05-international-guests-and-exhibitors', {
      label: 'International Guests',
      purpose: 'Public directory of international guests and exhibitors attending the show.',
    }),
    sanityFetch<NurseryCardData[]>({
      query: internationalNurseriesQuery,
      tags: ['vendorNursery', 'sanity'],
    }),
    loadShowFacts(),
  ]);

  const list = nurseries ?? [];

  return (
    <>
      <ShowContentState
        result={result}
        route="/national-show/international-guests"
        layout="listing"
        listingEmpty={list.length === 0}
        holding={{ facts, statement: ABSENCE_STATEMENT }}
        listingContent={
          list.length > 0 ? (
            <ShowEntityGrid
              items={list}
              itemKey={(nursery) => nursery._id}
              renderCard={(nursery) => <NurseryCard nursery={nursery} />}
            />
          ) : (
            <RealEmptyListing
              fieldLabels={CARD_FIELD_LABELS}
              absenceStatement={ABSENCE_STATEMENT}
            />
          )
        }
      />
      <NosShowIndex current="/national-show/international-guests" />
    </>
  );
}
