import type { Metadata } from 'next';
import Link from 'next/link';

import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { loadShowFacts } from '@/lib/data/show-facts';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

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
  image: nosOgImage('Programme — National Orchid Show'),
  description: 'The overall schedule of sessions across the four days of the National Show.',
  path: '/national-show/programme',
});

const PROGRAMME_PURPOSE = 'The overall schedule of sessions across the four show days.';

export default async function ProgrammePage() {
  const [result, facts] = await Promise.all([
    loadShowPageOrFallback('11-programme', {
      label: 'Programme',
      purpose: PROGRAMME_PURPOSE,
    }),
    loadShowFacts(),
  ]);

  return (
    <>
      <ShowContentState
        result={result}
        route="/national-show/programme"
        layout="prose"
        holding={{ facts, statement: PROGRAMME_PURPOSE }}
        afterProse={
          <p
            data-nos-programme-links
            className="flex max-w-[60ch] flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-6 font-sans text-[15px] leading-relaxed"
          >
            <Link href="/national-show/symposium" className="inline-link">
              SAOC Symposium
            </Link>
            <Link href="/national-show/workshops" className="inline-link">
              Workshops
            </Link>
          </p>
        }
      />
      <NosShowIndex current="/national-show/programme" />
    </>
  );
}
