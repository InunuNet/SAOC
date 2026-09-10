import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ShowSectionNav } from '@/components/show';
import { NosHero } from '@/components/nos/NosHero';
import { ShowPageProse } from '@/components/nos/ShowPageProse';
import { loadShowPage } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F12 (national-show-ia-alignment, M4) — created route. One sentence of real source
// (the `theme` section) exists; everything else is placeholder under an R11 disclosure
// until the Council confirms the symposium's date and venue.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'SAOC Symposium — National Orchid Show',
  description: 'What the SAOC Symposium is, and who it is for.',
  path: '/national-show/symposium',
});

export default async function SymposiumPage() {
  const page = await loadShowPage('06-saoc-symposium');
  if (!page) notFound();

  return (
    <>
      <NosHero
        image="/images/orchid-dark.jpg"
        eyebrow="National Show"
        title={page.title}
        lede={page.summary ?? undefined}
        priority
      />

      <div className="mx-auto max-w-[900px] space-y-10 px-8 py-16">
        {page.sections.map((section) => (
          <ShowPageProse key={section.sectionKey} section={section} />
        ))}
      </div>

      <ShowSectionNav current="/national-show/symposium" />
    </>
  );
}
