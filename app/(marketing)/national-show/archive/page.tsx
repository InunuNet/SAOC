import type { Metadata } from 'next';
import Link from 'next/link';

import { mergePastShows } from '@/lib/data/mergeShows';
import type { SanityShowProjection } from '@/lib/data/mergeShows';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery, pastShowsQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import { formatShowMonthYear, showLabelWithEdition } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';
import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { EditionCard } from '@/components/nos/EditionCard';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { ShowEntityGrid } from '@/components/show/nos/ShowEntityGrid';
import { ConfirmationBadge } from '@/components/show';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

// Self-canonical, and deliberately carries no Event markup: a past edition is not bookable,
// and a second Event under the live show's own name would compete with it. See M6/B8e.
const LEDE = 'The South African National Orchid Show is the council’s triennial event.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Archive',
  image: nosOgImage('National Show Archive'),
  description: 'Past editions of the South African National Orchid Show.',
  lede: LEDE,
  path: '/national-show/archive',
});

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
  // F7: the CTA band advertised the edition, the month/year and the city as literals.
  // Every one of them is a Studio edit away from being wrong, so all three come from
  // the nationalShow singleton. See show-identity-surfaces.golden.md.
  const [sanityShows, upcoming] = await Promise.all([
    sanityFetch<SanityShowProjection[]>({ query: pastShowsQuery, tags: ['show', 'sanity'] }),
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
  ]);

  const upcomingLabel = showLabelWithEdition(upcoming?.edition);
  const upcomingTitle = `The ${showLabelWithEdition(upcoming?.edition, 'National Orchid Show')}`;
  const upcomingMonthYear = formatShowMonthYear(upcoming?.showDate);
  const upcomingCity = upcoming?.venue?.city ?? null;
  const upcomingSentence = [
    `${upcomingTitle} takes place`,
    upcomingMonthYear ? ` in ${upcomingMonthYear}` : ' on dates yet to be confirmed',
    upcomingCity ? ` in ${upcomingCity}.` : '.',
  ].join('');

  // The same record set the detail page reads. Only a published Sanity past show appears
  // here; there is no static fallback. See lib/data/mergeShows.ts.
  const pastShows = mergePastShows(sanityShows);
  // R78: with no published past show, a public build shows the committee-records card alone
  // (no facts rail, no sibling cards: the Explore index below already lists them), without the
  // planning band; the beta card keeps its pending chip.
  const holds = withholdPlaceholderProse() && pastShows.length === 0;

  return (
    <>
      <NosHero
        route="/national-show/archive"
        title="National Show archive"
        lede={LEDE}
        priority
        actions={
          <Link
            href="/national-show"
            data-nos-backlink=""
            className="inline-flex min-h-[44px] items-center font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--lilac-muted)] transition-colors duration-150 hover:text-ivory"
          >
            ← National Show
          </Link>
        }
      />

      {/* ── Show grid ── */}
      <NosSection>
        {pastShows.length > 0 ? (
          <>
            <h2 className="sr-only">National Show editions</h2>
            <div className="nos-surface mb-10">
              <ConfirmationBadge status="pending" />
            </div>
            <ShowEntityGrid
              items={pastShows}
              itemKey={(show) => String(show.year)}
              renderCard={(show) => (
                <EditionCard
                  href={`/national-show/archive/${show.year}`}
                  year={show.year}
                  title={
                    show.title ??
                    (show.edition
                      ? `Edition ${toRomanOrdinal(show.edition)}`
                      : 'National Orchid Show')
                  }
                  venue={
                    [show.host, show.venue && show.venue !== show.host ? show.venue : null]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  chips={[
                    ...(show.entries ? [`${show.entries.toLocaleString()} entries`] : []),
                    ...(show.exhibitors ? [`${show.exhibitors.toLocaleString()} exhibitors`] : []),
                    ...(show.visitors ? [`${show.visitors.toLocaleString()} visitors`] : []),
                    ...(show.trophies ? [`${show.trophies} trophies`] : []),
                  ]}
                  note={show.note}
                />
              )}
            />
          </>
        ) : (
          <div className="nos-surface">
            {holds ? null : <ConfirmationBadge status="pending" />}
            <h2 className={`${holds ? '' : 'mt-3 '}font-serif text-[28px] font-medium text-ink`}>
              Show history awaiting committee records
            </h2>
          </div>
        )}
      </NosSection>

      {holds ? null : (
        <CtaBand
          title={`Planning for the ${upcomingLabel}?`}
          lede={upcomingSentence}
          action={
            <div className="flex flex-wrap justify-center gap-4">
              <Button as={Link} href="/national-show" variant="on-dark">
                View {upcomingLabel} details
              </Button>
              <Button as={Link} href="/contact" variant="ghost-on-dark">
                Ask the council
              </Button>
            </div>
          }
        />
      )}
      <NosShowIndex current="/national-show/archive" />
    </>
  );
}
