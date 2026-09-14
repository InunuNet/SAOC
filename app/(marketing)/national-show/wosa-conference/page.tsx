import type { Metadata } from 'next';

import { ShowSectionNav } from '@/components/show';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F12 (national-show-ia-alignment, M4) — created route.
//
// SAOC is orchids IN CULTIVATION (CLAUDE.md § "Critical scope boundary"). Wild orchid
// identification, habitat and conservation belong to WOSA, a separate organisation with
// its own site — this page states what the conference is and links OUT; it generates no
// wild-orchid content of its own. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md §4
// and goldens/m3/wosa-content-boundary.golden.md.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// The WOSA link-out below is static and independent of the ShowPage, so it is passed as
// `afterProse` and rendered in the published branch only — an absent page shows the
// disclosure alone. See goldens/m4/never-404-fallback.golden.md.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'WOSA Conference — National Orchid Show',
  description: 'The WOSA Conference, held alongside the National Show, and what it is for.',
  path: '/national-show/wosa-conference',
});

export default async function WosaConferencePage() {
  const result = await loadShowPageOrFallback('07-wosa-conference', {
    label: 'WOSA Conference',
    purpose:
      'What the WOSA Conference is and who it is for, with a link out to WOSA for wild-orchid content.',
  });

  return (
    <>
      <ShowContentState
        result={result}
        heroImage="/images/orchid-pink.jpg"
        layout="prose"
        afterProse={
          // SAOC attributes and links out; it never authors conservation content in its
          // own voice — the same standing rule the /about page's WOSA credit follows.
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
        }
      />

      <ShowSectionNav current="/national-show/wosa-conference" />
    </>
  );
}
