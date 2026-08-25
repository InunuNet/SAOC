import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { mergePastShows, type ArchiveShow } from '@/lib/data/mergeShows';
import type { SanityShowProjection } from '@/lib/data/mergeShows';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery, pastShowsQuery } from '@/sanity/queries';
import { showLabelWithEdition, showYearOf } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

const NOT_RECORDED = '—';

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

/**
 * "Edition XVIII · 2024" where the edition is known, the bare year where it is not —
 * a Sanity-only show has no static counterpart to supply an edition number, and
 * inventing one or rendering "Edition " with nothing after it would both be wrong.
 */
function editionLabel(show: ArchiveShow): string {
  return show.edition ? `Edition ${toRomanOrdinal(show.edition)} · ${show.year}` : String(show.year);
}

/** Joins only the facts that are actually recorded, so nothing renders as "undefined". */
function subtitle(show: ArchiveShow): string {
  return [show.month ? `${show.month} ${show.year}` : String(show.year), show.venue, show.host]
    .filter(Boolean)
    .join(' · ');
}

function summarySentence(show: ArchiveShow): string {
  const name = show.edition
    ? `The ${toRomanOrdinal(show.edition)} National Orchid Show`
    : `The ${show.year} National Orchid Show`;
  const when = show.month ? ` in ${show.month} ${show.year}` : ` in ${show.year}`;
  const where = show.venue ? ` at ${show.venue}` : '';
  const host = show.host ? `, hosted by the orchid societies of ${show.host}` : '';
  const trophies = show.trophies ? ` ${show.trophies} trophies and awards were presented.` : '';
  return `${name} was held${when}${where}${host}.${trophies}`;
}

async function loadPastShows(): Promise<ArchiveShow[]> {
  const sanityShows = await sanityFetch<SanityShowProjection[]>({
    query: pastShowsQuery,
    tags: ['show', 'sanity'],
  });
  return mergePastShows(sanityShows);
}

export async function generateStaticParams(): Promise<Array<{ year: string }>> {
  // Unions the static years and the Sanity `status == "past"` years, so a show added in
  // the Studio is prerendered rather than left to the dynamic fallback.
  const pastShows = await loadPastShows();
  return pastShows.map((s) => ({ year: String(s.year) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  const pastShows = await loadPastShows();
  const show = pastShows.find((s) => String(s.year) === year);
  if (!show) return { title: `National Show ${year}` };
  return {
    title: show.host
      ? `${year} National Orchid Show — ${show.host}`
      : `${year} National Orchid Show`,
    description: summarySentence(show),
  };
}

export default async function ShowYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const [pastShows, upcoming] = await Promise.all([
    loadPastShows(),
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
  ]);
  const show = pastShows.find((s) => String(s.year) === year);

  if (!show) notFound();

  // F7: edition, city and year on the CTA are show-identity facts, from the singleton.
  const upcomingLabel = showLabelWithEdition(upcoming?.edition);
  const upcomingYear = showYearOf(upcoming?.showDate);
  const upcomingPlaceAndYear = [upcoming?.venue?.city, upcomingYear ? String(upcomingYear) : null]
    .filter((part): part is string => Boolean(part))
    .join(' ');
  const upcomingWhere = upcomingPlaceAndYear ? `, ${upcomingPlaceAndYear}` : '';

  const currentIdx = pastShows.findIndex((s) => s.year === show.year);
  const nextShow = pastShows[currentIdx - 1] ?? null;
  const prevShow = pastShows[currentIdx + 1] ?? null;

  return (
    <>
      {/* ── Hero ── */}
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
            href="/national-show/archive"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/60 hover:text-ivory transition-colors duration-150 mb-8"
          >
            ← Archive
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-2">
            {editionLabel(show)}
          </p>
          <h1 className="font-serif text-[clamp(36px,4.8vw,64px)] font-medium leading-[1.06] tracking-[-0.012em] text-ivory max-w-[18ch]">
            The {show.year} South African National{' '}
            <em className="not-italic text-accent-soft">Orchid Show</em>
          </h1>
          <p className="mt-5 font-sans text-[17px] text-ivory/70">{subtitle(show)}</p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-bone">
        <div className="mx-auto max-w-[1280px] px-8 py-16">
          <div className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
            {[
              {
                value: show.edition ? toRomanOrdinal(show.edition) : NOT_RECORDED,
                label: 'Edition',
              },
              { value: show.days ? `${show.days} days` : NOT_RECORDED, label: 'Duration' },
              {
                value: show.entries ? show.entries.toLocaleString() : NOT_RECORDED,
                label: 'Entries',
              },
              {
                value: show.visitors ? show.visitors.toLocaleString() : NOT_RECORDED,
                label: 'Visitors',
              },
            ].map(({ value, label }) => (
              <div key={label} className="bg-bone px-8 py-10">
                <div className="font-serif text-[42px] font-medium leading-none text-primary">
                  {value}
                </div>
                <div className="mt-2 font-mono text-[11px] tracking-[0.16em] text-muted">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Show details ── */}
      <section className="mx-auto max-w-[1280px] px-8 py-20">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent mb-4">
              About the show
            </p>
            <p className="font-sans text-[16px] leading-relaxed text-ink/80">
              {summarySentence(show)}
            </p>
            {show.exhibitors ? (
              <p className="mt-4 font-sans text-[16px] leading-relaxed text-ink/80">
                {show.exhibitors.toLocaleString()} exhibitors took part.
              </p>
            ) : null}
            {show.note && (
              <p className="mt-4 font-serif text-[16px] italic text-muted">{show.note}</p>
            )}
          </div>

          <div className="relative aspect-[4/3] overflow-hidden bg-primary-800">
            <Image
              src="/images/orchid-purple.jpg"
              alt={`${show.year} National Orchid Show`}
              fill
              className="object-cover opacity-70"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* ── Pagination ── */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-[1280px] px-8 py-12 flex justify-between items-center gap-4">
          {prevShow ? (
            <Link
              href={`/national-show/archive/${prevShow.year}`}
              className="group flex flex-col gap-1"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted group-hover:text-primary transition-colors duration-150">
                ← Earlier
              </span>
              <span className="font-serif text-[20px] font-medium text-ink group-hover:text-primary transition-colors duration-150">
                {prevShow.host ? `${prevShow.year} — ${prevShow.host}` : prevShow.year}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {nextShow ? (
            <Link
              href={`/national-show/archive/${nextShow.year}`}
              className="group flex flex-col gap-1 text-right"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted group-hover:text-primary transition-colors duration-150">
                Later →
              </span>
              <span className="font-serif text-[20px] font-medium text-ink group-hover:text-primary transition-colors duration-150">
                {nextShow.host ? `${nextShow.year} — ${nextShow.host}` : nextShow.year}
              </span>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-bone py-16">
        <div className="mx-auto max-w-[1280px] px-8 text-center">
          <h2 className="font-serif text-[clamp(24px,3vw,36px)] font-medium text-ink">
            Next up: the {upcomingLabel}{upcomingWhere}
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/national-show"
              className="font-sans text-[14px] font-medium bg-primary px-6 py-3 text-ivory transition-colors duration-150 hover:bg-primary-800"
            >
              View {upcomingLabel}
            </Link>
            <Link
              href="/national-show/archive"
              className="font-sans text-[14px] font-medium border border-ink/30 px-6 py-3 text-ink transition-colors duration-150 hover:bg-ink/5"
            >
              Full Archive
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
