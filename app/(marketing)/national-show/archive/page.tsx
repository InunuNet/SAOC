import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { shows as staticShows } from '@/lib/data/shows';
import { sanityFetch } from '@/sanity/lib/fetch';
import { pastShowsQuery } from '@/sanity/queries';
import type { NationalShow } from '@/types';

export const metadata: Metadata = {
  title: 'National Show Archive',
  description:
    'A record of every South African National Orchid Show — past editions, host provinces, entry numbers, and winners.',
};

interface SanityPastShow {
  _id: string;
  title: string | null;
  slug: string | null;
  year: number;
  location: string | null;
  entries: number | null;
  exhibitors: number | null;
  awards: number | null;
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
  const sanityShows = await sanityFetch<SanityPastShow[]>({
    query: pastShowsQuery,
    tags: ['show', 'sanity'],
  });

  const pastShows: NationalShow[] =
    sanityShows && sanityShows.length > 0
      ? sanityShows.map((s) => ({
          edition: 0,
          year: s.year,
          month: 'September',
          host: s.location ?? '',
          venue: s.location ?? '',
          status: 'past',
          entries: s.entries ?? undefined,
          visitors: s.exhibitors ?? undefined,
          trophies: s.awards ?? undefined,
        }))
      : staticShows.filter((s) => s.status === 'past');

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
                  {show.edition > 0 ? `Edition ${toRomanOrdinal(show.edition)}` : show.year}
                </span>
              </div>

              <div className="flex flex-col gap-4 p-6">
                <div>
                  <p className="font-serif text-[22px] font-medium text-ink leading-snug">
                    {show.year} — {show.month}
                  </p>
                  <p className="mt-1 font-sans text-[14px] text-muted">{show.host}</p>
                  {show.venue && show.venue !== show.host && (
                    <p className="font-sans text-[13px] text-muted/70">{show.venue}</p>
                  )}
                </div>

                {(show.entries || show.visitors || show.trophies) && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-rule">
                    {show.entries && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] bg-bone px-2 py-1 text-muted">
                        {show.entries.toLocaleString()} entries
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
            Planning for the 19th Show?
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-[16px] text-ink/70">
            The 19th National Orchid Show takes place in September 2027 in Cape Town.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/national-show"
              className="font-sans text-[14px] font-medium bg-primary px-6 py-3 text-ivory transition-colors duration-150 hover:bg-primary-800"
            >
              View 19th Show Details
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
