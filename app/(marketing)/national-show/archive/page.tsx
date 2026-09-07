import type { Metadata } from 'next';
import Image from 'next/image';
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
import { Badge } from '@/components/nos/Badge';
import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { NOS_HERO_IMAGES, NosHero, type NosHeroImage } from '@/components/nos/NosHero';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

// Self-canonical, and deliberately carries no Event markup: a past edition is not bookable,
// and a second Event under the live show's own name would compete with it. See M6/B8e.
export const metadata: Metadata = buildPageMetadata({
  title: 'National Show Archive',
  description:
    'A record of every South African National Orchid Show — past editions, host provinces, entry numbers, and winners.',
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

/**
 * Deterministic photo per edition, keyed off edition (falling back to year for a
 * Sanity-only show with no edition number) — so a given show always gets the same one
 * of the five cleared photographs, on this page and on its own /archive/[year] page.
 * Never randomised: a card that changed image on reload would look broken.
 */
function archivePhotoFor(show: { edition?: number | null; year: number }): NosHeroImage {
  const key = show.edition ?? show.year;
  return NOS_HERO_IMAGES[key % NOS_HERO_IMAGES.length];
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
      <NosHero
        image="/images/orchid-dark.jpg"
        eyebrow="Show history"
        title="National Show archive"
        lede="Since 1974, the South African National Orchid Show has rotated across the country’s provinces every three years — a triennial celebration of orchid culture."
        priority
        actions={
          <Link
            href="/national-show"
            className="font-sans text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--lilac-muted)] transition-colors duration-150 hover:text-ivory"
          >
            ← National Show
          </Link>
        }
      />

      {/* ── Show grid ── */}
      <section className="mx-auto max-w-[1280px] px-8 py-24">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pastShows.map((show) => (
            <Link
              key={show.year}
              href={`/national-show/archive/${show.year}`}
              className="group block focus-visible:outline-none"
            >
              <div className="flex h-full flex-col overflow-hidden rounded-[length:var(--radius-card)] border-[length:var(--border-hairline)] border-[var(--rule)] bg-white shadow-[var(--shadow-card)] transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--ring-focus)]">
                <div className="relative aspect-[3/2] overflow-hidden bg-[var(--night)]">
                  <Image
                    src={archivePhotoFor(show)}
                    alt={`${show.year} National Orchid Show`}
                    fill
                    className="object-cover opacity-70"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <span className="absolute left-3 top-3">
                    <Badge tone="purple">
                      {show.edition ? `Edition ${toRomanOrdinal(show.edition)}` : show.year}
                    </Badge>
                  </span>
                </div>

                <div className="flex flex-col gap-4 p-6">
                  <div>
                    <p className="font-serif text-[22px] font-medium leading-snug text-ink">
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
                    // tone="purple" not "olive": olive-deep is 4.30:1 on white, which fails
                    // body-text contrast at this pill's 11px size (needs 4.5:1) — see
                    // nos-contrast.golden.md note 1. Olive text is legal only on dark grounds
                    // or as large (≥24px) text.
                    <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
                      {show.entries && (
                        <Badge tone="purple">{show.entries.toLocaleString()} entries</Badge>
                      )}
                      {show.exhibitors && (
                        <Badge tone="purple">{show.exhibitors.toLocaleString()} exhibitors</Badge>
                      )}
                      {show.visitors && (
                        <Badge tone="purple">{show.visitors.toLocaleString()} visitors</Badge>
                      )}
                      {show.trophies && <Badge tone="purple">{show.trophies} trophies</Badge>}
                    </div>
                  )}

                  {show.note && (
                    <p className="font-serif text-[14px] italic text-muted">{show.note}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {pastShows.length === 0 && (
          <p className="py-16 text-center font-sans text-[16px] text-muted">
            Archive records coming soon.
          </p>
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
