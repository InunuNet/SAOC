import type { Metadata } from 'next';
import Image from 'next/image';

import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { NurseryCard, type NurseryCardData } from '@/components/show/nos/NurseryCard';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { loadShowFacts } from '@/lib/data/show-facts';
import { buildPageMetadata } from '@/lib/seo';
import { sanityFetch } from '@/sanity/lib/fetch';
import { internationalNurseriesQuery } from '@/sanity/queries';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// F14 (national-show-ia-alignment, M4): a REAL listing over vendorNursery, filtered to guests
// outside South Africa. Zero invented guests (route-manifest.golden.md section 5).
//
// nos-content-standard: there is no Drive document for this page, and the build's own intro and
// "Who will appear" prose is AI placeholder copy (provenance placeholder-ai), so it is not rendered
// (R7, no invention). The page is the hero and the listing: the confirmed guests, or the project's
// own absence statement in the SP-1 empty panel until there are any.
export const revalidate = 60;

const PAGE_TITLE = 'International guests';
const LISTING_HEADING = 'Guests and exhibitors';
const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;
const EMBLEM_SIZE_PX = 88;

const ABSENCE_STATEMENT =
  'No international guests or exhibitors have been confirmed for 2027 yet. Confirmed ' +
  'guests will appear here, one card per exhibitor, as they register ahead of the show.';

export const metadata: Metadata = buildPageMetadata({
  title: 'International Guests and Exhibitors',
  image: nosOgImage('International Guests and Exhibitors — National Orchid Show'),
  description: 'International guests and exhibitors attending the National Orchid Show.',
  path: '/national-show/international-guests',
});

export default async function InternationalGuestsPage() {
  const [nurseries, showFacts] = await Promise.all([
    sanityFetch<NurseryCardData[]>({
      query: internationalNurseriesQuery,
      tags: ['vendorNursery', 'sanity'],
    }),
    loadShowFacts(),
  ]);
  const list = nurseries ?? [];

  return (
    <>
      <NosHero
        route="/national-show/international-guests"
        title={PAGE_TITLE}
        crumbLabel={PAGE_TITLE}
        facts={heroFactsFromShow(showFacts, FACTS_LABELS)}
        priority
      />

      <NosSection tone="gold" aria-labelledby="ig-listing-h">
        <div className="nos-sp-wall-head">
          <h2 id="ig-listing-h" className="doc-h2">
            {LISTING_HEADING}
          </h2>
        </div>
        {list.length > 0 ? (
          <ShowEntityGrid
            items={list}
            itemKey={(nursery) => nursery._id}
            renderCard={(nursery) => <NurseryCard nursery={nursery} />}
          />
        ) : (
          <div className="nos-sp-empty" data-nos-empty-state="international-guests">
            <Image
              src="/images/Eulophia-speciosa-emblem.png"
              alt=""
              width={EMBLEM_SIZE_PX}
              height={EMBLEM_SIZE_PX}
            />
            <p>{ABSENCE_STATEMENT}</p>
          </div>
        )}
      </NosSection>
      <NosShowIndex current="/national-show/international-guests" />
    </>
  );
}
