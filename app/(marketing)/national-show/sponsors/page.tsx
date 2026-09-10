import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ShowSectionNav } from '@/components/show';
import { NosHero } from '@/components/nos/NosHero';
import { ShowPageProse } from '@/components/nos/ShowPageProse';
import { RealEmptyListing } from '@/components/show/nos/RealEmptyListing';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { ShowSponsorCard, type ShowSponsorCardData } from '@/components/show/nos/ShowSponsorCard';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showSponsorsQuery } from '@/sanity/queries';
import { loadShowPage } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F14 (national-show-ia-alignment, M4) — created route, reinstated by Brad. Its OWN data
// scope: showSponsor, never the site-level `sponsor` type site-level /sponsors reads —
// the two lists must be able to diverge. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md §6.
// Nothing here imports partnersQuery or references the site-level sponsor document
// type's GROQ filter (D51/SP2) — spelled out rather than quoted literally, because a
// comment containing the literal filter string is a false positive for that same check.
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
  const [page, sponsors] = await Promise.all([
    loadShowPage('15-sponsors'),
    sanityFetch<ShowSponsorCardData[]>({
      query: showSponsorsQuery,
      tags: ['showSponsor', 'sanity'],
    }),
  ]);
  if (!page) notFound();

  const list = sponsors ?? [];

  return (
    <>
      <NosHero
        image="/images/orchid-dark.jpg"
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
            itemKey={(sponsor) => sponsor._id}
            renderCard={(sponsor) => <ShowSponsorCard sponsor={sponsor} />}
          />
        ) : (
          <RealEmptyListing fieldLabels={CARD_FIELD_LABELS} absenceStatement={ABSENCE_STATEMENT} />
        )}
      </div>

      <ShowSectionNav current="/national-show/sponsors" />
    </>
  );
}
