import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { mergePastShows, type ArchiveShow } from '@/lib/data/mergeShows';
import type { SanityShowProjection } from '@/lib/data/mergeShows';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery, pastShowsQuery } from '@/sanity/queries';
import { showPastShowsRoute } from '@/lib/data/past-shows-public';
import { showLabelWithEdition, showYearOf } from '@/lib/show-identity';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowIdentity } from '@/types';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { CtaBand } from '@/components/nos/CtaBand';
import { NosBreadcrumb } from '@/components/nos/NosBreadcrumb';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { ConfirmationBadge } from '@/components/show';
import { ArrowIcon } from '@/components/tickets/keepsake/parts';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

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
  return show.edition
    ? `Edition ${toRomanOrdinal(show.edition)} · ${show.year}`
    : String(show.year);
}

/** Joins only the facts that are actually recorded, so nothing renders as "undefined". */
function subtitle(show: ArchiveShow): string {
  return [show.month ? `${show.month} ${show.year}` : String(show.year), show.venue, show.host]
    .filter(Boolean)
    .join(' · ');
}

/**
 * One sentence built only from recorded facts. Returns null when nothing beyond the year
 * is recorded, so the page shows the pending marker instead of an invented sentence.
 */
function summarySentence(show: ArchiveShow): string | null {
  const facts = [
    show.month ? `in ${show.month} ${show.year}` : null,
    show.venue ? `at ${show.venue}` : null,
    show.host ? `hosted by the orchid societies of ${show.host}` : null,
  ].filter((fact): fact is string => fact !== null);
  if (facts.length === 0) return null;
  const name = show.edition
    ? `The ${toRomanOrdinal(show.edition)} National Orchid Show`
    : `The ${show.year} National Orchid Show`;
  return `${name} was held ${facts.join(', ')}.`;
}

async function loadPastShows(): Promise<ArchiveShow[]> {
  const sanityShows = await sanityFetch<SanityShowProjection[]>({
    query: pastShowsQuery,
    tags: ['show', 'sanity'],
  });
  return mergePastShows(sanityShows);
}

// An unrecorded year calls notFound(), which renders the host-aware root not-found (it reads the request
// headers). Next fails a statically generated route whose not-found turns dynamic at runtime (500), so
// this page is dynamic. dynamicParams = false would also work but would 404 a newly published year until
// the next deploy.
export const dynamic = 'force-dynamic';

export async function generateStaticParams(): Promise<Array<{ year: string }>> {
  // The Sanity `status == "past"` years only; empty until a real edition is published.
  const pastShows = await loadPastShows();
  return pastShows.map((s) => ({ year: String(s.year) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  const path = `/national-show/archive/${year}`;
  if (!(await showPastShowsRoute())) notFound();
  const pastShows = await loadPastShows();
  const show = pastShows.find((s) => String(s.year) === year);

  // SELF-canonical, never pointed at /national-show. Cross-canonicalising would deindex
  // genuinely unique historical content; the year-leading title is what separates a past
  // edition from the live show in results, now that the schema linkage is deliberately gone.
  // Unrecorded year: notFound() here as well as in the page, so the hydrated head carries the
  // not-found's metadata rather than reverting to a year title and canonical.
  if (!show) notFound();

  const title = show.host ? `${year} — ${show.host}` : year;
  return buildPageMetadata({
    title,
    image: nosOgImage(title),
    description: summarySentence(show) ?? `The ${year} National Orchid Show.`,
    path,
  });
}

export default async function ShowYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  if (!(await showPastShowsRoute())) notFound();
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

  const summary = summarySentence(show);
  const stats = [
    show.edition ? { value: toRomanOrdinal(show.edition), label: 'Edition' } : null,
    show.days ? { value: `${show.days} days`, label: 'Duration' } : null,
    show.entries ? { value: show.entries.toLocaleString(), label: 'Entries' } : null,
    show.visitors ? { value: show.visitors.toLocaleString(), label: 'Visitors' } : null,
  ].filter((stat): stat is { value: string; label: string } => stat !== null);

  const currentIdx = pastShows.findIndex((s) => s.year === show.year);
  const nextShow = pastShows[currentIdx - 1] ?? null;
  const prevShow = pastShows[currentIdx + 1] ?? null;

  return (
    <>
      <NosHero
        route={`/national-show/archive/${show.year}`}
        title={`The ${show.year} National Orchid Show`}
        lede={subtitle(show)}
        priority
        actions={
          <Link
            href="/archive"
            data-nos-backlink=""
            data-nos-backarrow=""
            className="inline-flex min-h-[44px] items-center font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--lilac-muted)] transition-colors duration-150 hover:text-ivory"
          >
            <ArrowIcon />
            Past shows
          </Link>
        }
      />

      {/* Ruling 2026-10-16 #6: the edition label is the current crumb, not a hero eyebrow. */}
      <NosBreadcrumb
        items={[
          { label: 'Past shows', href: '/national-show/archive' },
          { label: editionLabel(show) },
        ]}
      />

      {/* ── Recorded stats: only values that exist ── */}
      {stats.length > 0 && (
        <NosSection tone="gold">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map(({ value, label }) => (
              <Card key={label} className="text-center">
                <div className="font-serif tracking-[-0.015em] text-[38px] font-medium leading-none text-primary">
                  {value}
                </div>
                <div className="mt-2 font-sans text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {label}
                </div>
              </Card>
            ))}
          </div>
        </NosSection>
      )}

      {/* ── Show details ── */}
      <NosSection>
        <div className="max-w-[60ch]">
          {summary ? (
            <p className="font-sans text-[16px] leading-[1.55] text-ink/80">{summary}</p>
          ) : (
            <ConfirmationBadge status="pending" />
          )}
          {show.exhibitors ? (
            <p className="mt-4 font-sans text-[16px] leading-[1.55] text-ink/80">
              {show.exhibitors.toLocaleString()} exhibitors took part.
            </p>
          ) : null}
          {show.note && (
            <p className="mt-4 font-serif text-[16px] italic text-muted">{show.note}</p>
          )}
        </div>
      </NosSection>

      {/* ── Pagination ── */}
      <NosSection
        className="border-t border-rule"
        wrapClassName="flex items-center justify-between gap-4"
      >
        {prevShow ? (
          <Link
            href={`/archive/${prevShow.year}`}
            data-nos-backarrow=""
            className="group flex flex-col gap-1"
          >
            <span className="inline-flex items-center font-sans text-[12px] font-semibold uppercase tracking-[0.18em] text-muted transition-colors duration-150 group-hover:text-primary">
              <ArrowIcon />
              Earlier
            </span>
            <span className="font-serif text-[20px] font-medium text-ink transition-colors duration-150 group-hover:text-primary">
              {prevShow.host ? `${prevShow.year} — ${prevShow.host}` : prevShow.year}
            </span>
          </Link>
        ) : (
          <div />
        )}
        {nextShow ? (
          <Link
            href={`/archive/${nextShow.year}`}
            className="group flex flex-col gap-1 text-right"
          >
            <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.18em] text-muted transition-colors duration-150 group-hover:text-primary">
              Later →
            </span>
            <span className="font-serif text-[20px] font-medium text-ink transition-colors duration-150 group-hover:text-primary">
              {nextShow.host ? `${nextShow.year} — ${nextShow.host}` : nextShow.year}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </NosSection>

      <CtaBand
        title={`Next up: the ${upcomingLabel}${upcomingWhere}`}
        action={
          <div className="flex flex-wrap justify-center gap-4">
            <Button as={Link} href="/" variant="on-dark">
              View {upcomingLabel}
            </Button>
            <Button as={Link} href="/archive" variant="ghost-on-dark">
              Past shows
            </Button>
          </div>
        }
      />
    </>
  );
}
