import type { Metadata } from 'next';

import { ConfirmationBadge, ShowSectionNav } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { ShowSponsorCard, type ShowSponsorCardData } from '@/components/show/nos/ShowSponsorCard';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showSponsorsQuery } from '@/sanity/queries';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';

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
// ShowContentState. See .agent/memory/project/specs/nos-critique-r1/goldens/critique-r1.golden.md.
export const revalidate = 60;

const NO_SPONSORS_YET = 'No Show sponsors have been confirmed for 2027 yet.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Show Sponsors — National Orchid Show',
  description: "The National Show's own sponsors.",
  path: '/national-show/sponsors',
});

export default async function ShowSponsorsPage() {
  const [result, sponsors] = await Promise.all([
    loadShowPageOrFallback('15-sponsors', {
      label: 'Show Sponsors',
      purpose: "The Show's own sponsors — a separate list from SAOC's site-level sponsors.",
    }),
    sanityFetch<ShowSponsorCardData[]>({
      query: showSponsorsQuery,
      tags: ['showSponsor', 'sanity'],
    }),
  ]);

  const list = sponsors ?? [];

  return (
    <>
      <div className="contents [&_[data-nos-content-state]_p]:max-w-[60ch] [&_[data-nos-content-state]_li]:max-w-[60ch]">
        <ShowContentState
          result={result}
          heroImage="/images/orchid-dark.jpg"
          layout="listing"
          listingContent={
            list.length > 0 ? (
              <ShowEntityGrid
                items={list}
                itemKey={(sponsor) => sponsor._id}
                renderCard={(sponsor) => <ShowSponsorCard sponsor={sponsor} />}
              />
            ) : (
              <Card data-nos-empty-state="sponsors" className="mx-auto max-w-[900px] p-8">
                <SectionHeading title="Become a sponsor" />
                <ConfirmationBadge status="pending" pendingLabel="To be confirmed by the show committee" />
                <p className="mt-3 font-sans text-[17px] leading-[1.65] text-ink/80">{NO_SPONSORS_YET}</p>
                <div className="mt-6">
                  <Button as="a" href="mailto:info@saoc.co.za">
                    Talk to us about sponsorship
                  </Button>
                </div>
              </Card>
            )
          }
        />
      </div>

      <ShowSectionNav current="/national-show/sponsors" />
    </>
  );
}
