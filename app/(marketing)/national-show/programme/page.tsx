import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ShowSectionNav } from '@/components/show';
import { NosHero } from '@/components/nos/NosHero';
import { ShowPageProse } from '@/components/nos/ShowPageProse';
import { loadShowPage } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F12 (national-show-ia-alignment, M4) — created route. Placeholder copy under an R11
// disclosure until the Council supplies the finished programme; see
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Programme — National Orchid Show',
  description: 'The overall schedule of sessions across the four days of the National Show.',
  path: '/national-show/programme',
});

export default async function ProgrammePage() {
  const page = await loadShowPage('11-programme');
  // R6 — loadShowPage returning null produces a 404, never an empty page that reads as
  // finished with nothing to say.
  if (!page) notFound();

  return (
    <>
      <NosHero
        image="/images/orchid-yellow.jpg"
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

      <ShowSectionNav current="/national-show/programme" />
    </>
  );
}
