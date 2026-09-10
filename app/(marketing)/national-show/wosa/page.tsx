import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ShowSectionNav } from '@/components/show';
import { NosHero } from '@/components/nos/NosHero';
import { ShowPageProse } from '@/components/nos/ShowPageProse';
import { loadShowPage } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F12 (national-show-ia-alignment, M4) — created route.
//
// SAOC is orchids IN CULTIVATION (CLAUDE.md § "Critical scope boundary"). Wild orchid
// identification, habitat and conservation belong to WOSA, a separate organisation with
// its own site — this page states what the conference is and links OUT; it generates no
// wild-orchid content of its own. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md §4
// and goldens/m3/wosa-content-boundary.golden.md.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'WOSA Conference — National Orchid Show',
  description: 'The WOSA Conference, held alongside the National Show, and what it is for.',
  path: '/national-show/wosa',
});

export default async function WosaConferencePage() {
  const page = await loadShowPage('07-wosa-conference');
  if (!page) notFound();

  return (
    <>
      <NosHero
        image="/images/orchid-pink.jpg"
        eyebrow="National Show"
        title={page.title}
        lede={page.summary ?? undefined}
        priority
      />

      <div className="mx-auto max-w-[900px] space-y-10 px-8 py-16">
        {page.sections.map((section) => (
          <ShowPageProse key={section.sectionKey} section={section} />
        ))}

        {/* SAOC attributes and links out; it never authors conservation content in its
            own voice — the same standing rule the /about page's WOSA credit follows. */}
        <p className="border-t border-rule pt-6 font-sans text-[15px] leading-relaxed text-ink/70">
          For wild orchid identification, habitat and conservation, visit our partner
          organisation{' '}
          <a
            href="https://wildorchids.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-link"
          >
            Wild Orchids of Southern Africa (WOSA)
          </a>
          .
        </p>
      </div>

      <ShowSectionNav current="/national-show/wosa" />
    </>
  );
}
