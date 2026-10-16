import type { Metadata } from 'next';

import { ConfirmationBadge } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { ShowSponsorCard, type ShowSponsorCardData } from '@/components/show/nos/ShowSponsorCard';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showSponsorsQuery } from '@/sanity/queries';
import { loadShowPageOrFallback, withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// F14 (national-show-ia-alignment, M4) — created route, reinstated by Brad. Its OWN data
// scope: showSponsor, never the site-level `sponsor` type site-level /sponsors reads —
// the two lists must be able to diverge. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md §6.
// Nothing here imports partnersQuery or references the site-level sponsor document
// type's GROQ filter (D51/SP2) — spelled out rather than quoted literally, because a
// comment containing the literal filter string is a false positive for that same check.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// The sponsor grid/empty state is independent of the ShowPage, so it is passed as
// `listingContent` and rendered in the published branch only. See
// goldens/m4/never-404-fallback.golden.md.
//
// nos-critique-r1 F1 — G2 designed empty state, page-local (RealEmptyListing is F2's and
// is not edited). Every string is sourced: the heading and the next step are the site's
// own sponsorship block (app/(marketing)/sponsors/page.tsx:109, :119), the chip is the R11
// pending label (Codi's bar G1; contracts/golden/show-visitor-info/
// confirmation-status-model.golden.md:28), and the line is the first sentence of the
// statement this page already carried — its wording has no council source, which the chip
// discloses. The prose wrapper caps the measure at 60ch (bar B3) without touching
// ShowContentState — scoped to .nos-show-page-prose (PortableText prose) so it never reaches
// the ShowEntityGrid <li> cards, which must keep filling their grid tracks. See .agent/memory/project/specs/nos-critique-r1/goldens/critique-r1.golden.md.
export const revalidate = 60;

const NO_SPONSORS_YET = 'No Show sponsors have been confirmed for 2027 yet.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Show Sponsors — National Orchid Show',
  image: nosOgImage('Show Sponsors — National Orchid Show'),
  description: "The National Show's own sponsors.",
  path: '/national-show/sponsors',
});

export default async function ShowSponsorsPage() {
  const [result, sponsors] = await Promise.all([
    loadShowPageOrFallback('15-sponsors', {
      label: 'Show Sponsors',
      purpose: 'The sponsors behind the National Show.',
    }),
    sanityFetch<ShowSponsorCardData[]>({
      query: showSponsorsQuery,
      tags: ['showSponsor', 'sanity'],
    }),
  ]);

  const list = sponsors ?? [];

  return (
    <>
      <div className="contents [&_.nos-show-page-prose_p]:max-w-[60ch] [&_.nos-show-page-prose_li]:max-w-[60ch]">
        <ShowContentState
          result={result}
          route="/national-show/sponsors"
          layout="listing"
          listingContent={
            list.length > 0 ? (
              <ShowEntityGrid
                items={list}
                itemKey={(sponsor) => sponsor._id}
                renderCard={(sponsor) => <ShowSponsorCard sponsor={sponsor} />}
              />
            ) : (
              <div>
                {/* A TBC marker is a beta-only note: a public build renders none. */}
                {withholdPlaceholderProse() ? null : (
                  <ConfirmationBadge
                    status="pending"
                    pendingLabel="To be confirmed by the show committee"
                  />
                )}
                <Card data-nos-empty-state="sponsors" className="mt-6 p-8">
                  <SectionHeading title="Become a sponsor" />
                  <p className="mt-3 max-w-[60ch] font-sans text-[17px] leading-[1.65] text-ink/80">
                    {NO_SPONSORS_YET}
                  </p>
                  <div className="mt-6">
                    <Button
                      as="a"
                      href="mailto:info@saoc.co.za"
                      className="whitespace-nowrap max-sm:w-full max-sm:!px-2"
                    >
                      Talk to us about sponsorship
                    </Button>
                  </div>
                </Card>
              </div>
            )
          }
        />
      </div>
      <NosShowIndex current="/national-show/sponsors" />
    </>
  );
}
