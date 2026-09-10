import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ShowSectionNav } from '@/components/show';
import { NosHero } from '@/components/nos/NosHero';
import { ShowPageProse } from '@/components/nos/ShowPageProse';
import { NurseryCard, type NurseryCardData } from '@/components/show/nos/NurseryCard';
import { RealEmptyListing } from '@/components/show/nos/RealEmptyListing';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { sanityFetch } from '@/sanity/lib/fetch';
import { internationalNurseriesQuery } from '@/sanity/queries';
import { loadShowPage } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F14 (national-show-ia-alignment, M4) — created route. Placeholder prose plus a REAL
// empty listing over vendorNursery, filtered to guests outside South Africa. Zero
// invented guests — see route-manifest.golden.md §5.
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
  const [page, nurseries] = await Promise.all([
    loadShowPage('05-international-guests-and-exhibitors'),
    sanityFetch<NurseryCardData[]>({
      query: internationalNurseriesQuery,
      tags: ['vendorNursery', 'sanity'],
    }),
  ]);
  if (!page) notFound();

  const list = nurseries ?? [];

  return (
    <>
      <NosHero
        image="/images/orchid-purple.jpg"
        eyebrow="National Show"
        title={page.title}
        lede={page.summary ?? undefined}
        priority
      />

      <div className="mx-auto max-w-[1280px] space-y-12 px-8 py-16">
        <div className="mx-auto max-w-[900px] space-y-10">
          {page.sections
            .filter((section) => section.kind === 'prose')
            .map((section) => (
              <ShowPageProse key={section.sectionKey} section={section} />
            ))}
        </div>

        {list.length > 0 ? (
          <ShowEntityGrid
            items={list}
            itemKey={(nursery) => nursery._id}
            renderCard={(nursery) => <NurseryCard nursery={nursery} />}
          />
        ) : (
          <RealEmptyListing fieldLabels={CARD_FIELD_LABELS} absenceStatement={ABSENCE_STATEMENT} />
        )}
      </div>

      <ShowSectionNav current="/national-show/international-guests" />
    </>
  );
}
