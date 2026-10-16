import type { Metadata } from 'next';
import Link from 'next/link';

import { mergePastShows } from '@/lib/data/mergeShows';
import type { SanityShowProjection } from '@/lib/data/mergeShows';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery, pastShowsQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import {
  formatShowMonthYear,
  showLabelWithEdition,
} from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';
import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { NosHero } from '@/components/nos/NosHero';
import { ConfirmationBadge } from '@/components/show';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

// Self-canonical, and deliberately carries no Event markup: a past edition is not bookable,
// and a second Event under the live show's own name would compete with it. See M6/B8e.
export const metadata: Metadata = buildPageMetadata({
  title: 'National Show Archive',
  description:
    'Past editions of the South African National Orchid Show.',
  path: '/national-show/archive',
});

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

  return (
    <>
      <NosHero
        image="/images/orchid-dark.jpg"
        title="National Show archive"
        lede="The South African National Orchid Show is the council’s triennial event."
        priority
        actions={
          <Link
            href="/national-show"
            className="inline-flex min-h-[44px] items-center font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--lilac-muted)] transition-colors duration-150 hover:text-ivory"
          >
            ← National Show
          </Link>
        }
      />

      {/* ── Show grid ── */}
      <section className="mx-auto max-w-[1280px] px-8 py-24">
        {pastShows.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pastShows.map((show) => (
              <Link
                key={show.year}
                href={`/national-show/archive/${show.year}`}
                className="group block focus-visible:outline-none"
              >
                <div className="flex h-full flex-col overflow-hidden rounded-[length:var(--radius-card)] border-[length:var(--border-primary)] border-[var(--rule)] bg-white transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--ring-focus)]">
                  <div className="flex aspect-[3/2] items-center justify-center bg-[var(--night)]">
                    <span className="font-serif text-[56px] font-medium leading-none text-ivory">
                      {show.year}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4 p-6">
                    <div>
                      <h2 className="nos-card-title font-serif text-[22px] font-medium leading-snug text-ink">
                        {show.title ?? show.year}
                      </h2>
                      {show.venue && (
                        <p className="mt-1 font-sans text-[14px] text-muted">{show.venue}</p>
                      )}
                    </div>
                    <ConfirmationBadge status="pending" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="max-w-[720px] space-y-3 border-l-2 border-dashed border-[color:var(--status-muted)] py-2 pl-5">
            {/* R11 disclosure: chip, one sentence, dashed 2px rail (see ShowPageProse). */}
            <ConfirmationBadge status="pending" />
            <h2 className="font-serif text-[28px] font-medium text-ink">
              Show history awaiting committee records
            </h2>
          </div>
        )}
      </section>

      <CtaBand
        eyebrow="What's next"
        title={`Planning for the ${upcomingLabel}?`}
        lede={upcomingSentence}
        action={
          <div className="flex flex-wrap justify-center gap-4">
            <Button as={Link} href="/national-show" variant="on-dark">
              View {upcomingLabel} details
            </Button>
            <Button as={Link} href="/contact" variant="ghost" className="border-[var(--lilac-muted)] text-ivory hover:bg-white/5">
              Ask the council
            </Button>
          </div>
        }
      />
    </>
  );
}
