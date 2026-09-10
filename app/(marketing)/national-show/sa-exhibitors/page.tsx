import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ShowSectionNav } from '@/components/show';
import { NosHero } from '@/components/nos/NosHero';
import { ShowPageProse } from '@/components/nos/ShowPageProse';
import { NurseryCard, type NurseryCardData } from '@/components/show/nos/NurseryCard';
import { RealEmptyListing } from '@/components/show/nos/RealEmptyListing';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { sanityFetch } from '@/sanity/lib/fetch';
import { southAfricanNurseriesQuery } from '@/sanity/queries';
import { loadShowPage } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F14 (national-show-ia-alignment, M4) — created route. THE PUBLIC NURSERY DIRECTORY,
// distinct from /national-show/exhibitors (the grower entry guide — see D45/D46/X2) and
// from /national-show/vendors (the trade showcase, another lane's untouchable route).
// Zero nurseries is the correct output on day one — see route-manifest.golden.md §5. No
// nursery name is invented; an invented one is an invented commercial relationship with
// a real business.
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
  const [page, nurseries] = await Promise.all([
    loadShowPage('04-south-african-exhibitors'),
    sanityFetch<NurseryCardData[]>({
      query: southAfricanNurseriesQuery,
      tags: ['vendorNursery', 'sanity'],
    }),
  ]);
  if (!page) notFound();

  const list = nurseries ?? [];

  return (
    <>
      <NosHero
        image="/images/orchid-violet.jpg"
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

      <ShowSectionNav current="/national-show/sa-exhibitors" />
    </>
  );
}
