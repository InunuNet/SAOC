import type { Metadata } from 'next';

import { ShowSectionNav } from '@/components/show';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F12 (national-show-ia-alignment, M4) — created route. Placeholder copy under an R11
// disclosure until the Council supplies the finished programme; see
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// See goldens/m4/never-404-fallback.golden.md.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Programme — National Orchid Show',
  description: 'The overall schedule of sessions across the four days of the National Show.',
  path: '/national-show/programme',
});

export default async function ProgrammePage() {
  const result = await loadShowPageOrFallback('11-programme', {
    label: 'Programme',
    purpose: 'The overall schedule of sessions across the four show days.',
  });

  return (
    <>
      <ShowContentState result={result} heroImage="/images/orchid-yellow.jpg" layout="prose" />

      <ShowSectionNav current="/national-show/programme" />
    </>
  );
}
