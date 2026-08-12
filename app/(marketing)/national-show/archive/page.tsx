import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { mergePastShows } from '@/lib/data/mergeShows';
import type { SanityShowProjection } from '@/lib/data/mergeShows';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery, pastShowsQuery } from '@/sanity/queries';
import {
  formatShowMonthYear,
  showLabelWithEdition,
} from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'National Show Archive',
  description:
    'A record of every South African National Orchid Show — past editions, host provinces, entry numbers, and winners.',
};

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

  // The same merge the detail page reads — the two pages previously disagreed about
  // the same show because the list took the Sanity branch wholesale and substituted
  // edition 0, a hardcoded month, and the host/venue and visitors/exhibitors
  // conflations. See lib/data/mergeShows.ts.
  const pastShows = mergePastShows(sanityShows);

  return (
    <>
      {/* ── Page hero ── */}
      <section className="relative overflow-hidden bg-primary-800 py-24">
        <Image
          src="/images/orchid-dark.jpg"
          alt=""
          fill
          priority
          className="object-cover opacity-25"
          sizes="100vw"
        />
        <div className="relative z-10 mx-auto max-w-[1280px] px-8">
          <Link
            href="/national-show"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/60 hover:text-ivory transition-colors duration-150 mb-8"
          >
            ← National Show
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-3">
            Show history
          </p>
          <h1 className="font-serif text-[clamp(42px,5.4vw,72px)] font-medium leading-[1.04] tracking-[-0.012em] text-ivory max-w-[16ch]">
            National Show Archive
          </h1>
          <p className="mt-6 font-sans text-[18px] leading-relaxed text-ivory/70 max-w-2xl">
            Since 1974, the South African National Orchid Show has rotated across the country&rsquo;s
            provinces every three years — a triennial celebration of orchid culture.
          </p>
        </div>
      </section>

      {/* ── Show grid ── */}
      <section className="mx-auto max-w-[1280px] px-8 py-24">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pastShows.map((show) => (
            <div key={show.year} className="flex flex-col border border-rule bg-parchment">
              <div className="relative aspect-[3/2] bg-primary-800 overflow-hidden">
                <Image
                  src="/images/orchid-purple.jpg"
                  alt={`${show.year} National Orchid Show`}
                  fill
                  className="object-cover opacity-60"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <span className="absolute left-3 top-3 font-mono text-[10px] uppercase tracking-[0.18em] bg-primary text-ivory px-2 py-1">
                  {show.edition ? `Edition ${toRomanOrdinal(show.edition)}` : show.year}
                </span>
              </div>

              <div className="flex flex-col gap-4 p-6">
                <div>
                  <p className="font-serif text-[22px] font-medium text-ink leading-snug">
                    {show.month ? `${show.year} — ${show.month}` : show.year}
                  </p>
                  {show.host && (
                    <p className="mt-1 font-sans text-[14px] text-muted">{show.host}</p>
                  )}
                  {show.venue && show.venue !== show.host && (
                    <p className="font-sans text-[13px] text-muted/70">{show.venue}</p>
                  )}
                </div>

                {(show.entries || show.exhibitors || show.visitors || show.trophies) && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-rule">
                    {show.entries && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] bg-bone px-2 py-1 text-muted">
                        {show.entries.toLocaleString()} entries
                      </span>
                    )}
                    {show.exhibitors && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] bg-bone px-2 py-1 text-muted">
                        {show.exhibitors.toLocaleString()} exhibitors
                      </span>
                    )}
                    {show.visitors && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] bg-bone px-2 py-1 text-muted">
                        {show.visitors.toLocaleString()} visitors
                      </span>
                    )}
                    {show.trophies && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] bg-bone px-2 py-1 text-muted">
                        {show.trophies} trophies
                      </span>
                    )}
                  </div>
                )}

                {show.note && (
                  <p className="font-serif text-[14px] italic text-muted">{show.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {pastShows.length === 0 && (
          <p className="font-sans text-[16px] text-muted text-center py-16">
            Archive records coming soon.
          </p>
        )}
      </section>

      {/* ── CTA band ── */}
      <section className="bg-bone py-20">
        <div className="mx-auto max-w-[1280px] px-8 text-center">
          <h2 className="font-serif text-[clamp(26px,3.2vw,40px)] font-medium text-ink">
            Planning for the {upcomingLabel}?
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-[16px] text-ink/70">
            {upcomingSentence}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/national-show"
              className="font-sans text-[14px] font-medium bg-primary px-6 py-3 text-ivory transition-colors duration-150 hover:bg-primary-800"
            >
              View {upcomingLabel} details
            </Link>
            <Link
              href="/contact"
              className="font-sans text-[14px] font-medium border border-ink/30 px-6 py-3 text-ink transition-colors duration-150 hover:bg-ink/5"
            >
              Ask the Council
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
