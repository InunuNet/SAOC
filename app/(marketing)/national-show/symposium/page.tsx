import type { Metadata } from 'next';

import { ShowSectionNav } from '@/components/show';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

// F12 (national-show-ia-alignment, M4) — created route. One sentence of real source
// (the `theme` section) exists; everything else is placeholder under an R11 disclosure
// until the Council confirms the symposium's date and venue.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// See goldens/m4/never-404-fallback.golden.md.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'SAOC Symposium — National Orchid Show',
  description: 'What the SAOC Symposium is, and who it is for.',
  path: '/national-show/symposium',
});

export default async function SymposiumPage() {
  const result = await loadShowPageOrFallback('06-saoc-symposium', {
    label: 'SAOC Symposium',
    purpose: 'The SAOC Symposium — what it is, its theme, and who it is for.',
  });

  return (
    <>
      <ShowContentState result={result} heroImage="/images/orchid-dark.jpg" layout="prose" />

      <ShowSectionNav current="/national-show/symposium" />
    </>
  );
}
