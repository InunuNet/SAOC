import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { mergePastShows } from '@/lib/data/mergeShows';
import type { SanityShowProjection } from '@/lib/data/mergeShows';
import { sanityFetch } from '@/sanity/lib/fetch';
import { pastShowsQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import { NosHero } from '@/components/nos/NosHero';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { showPastShowsRoute } from '@/lib/data/past-shows-public';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

// AR-1 (NOS Design, comms.md): "Past shows" carries no lede, no back link and no planning band; the
// builder's stand-in line, the "Planning for the ..." band and the arrow back link are gone. Each
// edition is one row of a ruled register, newest first, with the facts the committee recorded and
// nothing else: an empty cell is omitted, never filled. Self-canonical, and deliberately carries no
// Event markup: a past edition is not bookable, and a second Event under the live show's own name
// would compete with it. See M6/B8e.
const PAGE_TITLE = 'Past shows';
const FACT_LABELS = ['Entries', 'Exhibitors', 'Visitors', 'Trophies'] as const;

// notFound() here as well as in the page, so a withheld route's 404 carries the not-found's head
// rather than a canonical and og:url pointing at the missing page.
export async function generateMetadata(): Promise<Metadata> {
  if (!(await showPastShowsRoute())) notFound();
  return buildPageMetadata({
    title: PAGE_TITLE,
    image: nosOgImage(PAGE_TITLE),
    description: 'Past editions of the National Orchid Show.',
    path: '/national-show/archive',
  });
}

function toRomanOrdinal(n: number): string {
  const val = [50, 40, 10, 9, 5, 4, 1];
  const sym = ['L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < val.length; i++) {
    while (n >= val[i]) {
      result += sym[i];
      n -= val[i];
    }
  }
  return result;
}

export default async function ShowArchivePage() {
  // A public build has no Past shows page until Sanity holds a past show with recorded facts
  // (docs/nos-archive-public-r64.md); a preview build keeps it.
  if (!(await showPastShowsRoute())) notFound();

  // The same record set the detail page reads. Only a published Sanity past show appears
  // here; there is no static fallback. See lib/data/mergeShows.ts.
  const sanityShows = await sanityFetch<SanityShowProjection[]>({
    query: pastShowsQuery,
    tags: ['show', 'sanity'],
  });
  const pastShows = [...mergePastShows(sanityShows)].sort((a, b) => b.year - a.year);

  return (
    <>
      <NosHero route="/national-show/archive" title={PAGE_TITLE} crumbLabel={PAGE_TITLE} priority />

      <DocumentLayout>
        {pastShows.length > 0 ? (
          <>
            <h2 className="sr-only nos-ar-heading">National Show editions</h2>
            <ul className="nos-ar-register">
              {pastShows.map((show) => {
                const values = [show.entries, show.exhibitors, show.visitors, show.trophies];
                const facts = FACT_LABELS.flatMap((label, i) =>
                  values[i] ? [{ label, value: values[i].toLocaleString('en-ZA') }] : [],
                );
                return (
                  <li key={show.year} data-edition-record="">
                    <Link href={`/archive/${show.year}`}>
                      <span data-edition-year="" className="nos-ar-year">
                        {show.year}
                      </span>
                      <h2 className="nos-ar-title nos-card-title">
                        {show.title ??
                          (show.edition
                            ? `Edition ${toRomanOrdinal(show.edition)}`
                            : 'National Orchid Show')}
                      </h2>
                      {facts.length > 0 ? (
                        <dl className="nos-ar-facts">
                          {facts.map((fact) => (
                            <div key={fact.label}>
                              <dt>{fact.label}</dt>
                              <dd>{fact.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      <span aria-hidden="true" className="nos-ar-arrow">
                        &rarr;
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div>
            <div className="nos-surface">
              <h2 className="doc-h2">
                Show history awaiting committee records
              </h2>
            </div>
          </div>
        )}
      </DocumentLayout>
      <NosShowIndex current="/national-show/archive" />
    </>
  );
}
