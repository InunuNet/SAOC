import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

import { ShowCountdown } from '@/components/show';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showClassesQuery, pastShowsQuery } from '@/sanity/queries';
import { showClasses as staticClasses } from '@/lib/data/showClasses';
import { shows as staticShows } from '@/lib/data/shows';
import type { ShowClass, NationalShow } from '@/types';

export const metadata: Metadata = {
  title: 'National Orchid Show',
  description:
    'The South African National Orchid Show — the flagship triennial competition bringing together growers, judges and enthusiasts from all nine provinces.',
};

interface SanityShowClass {
  _id: string;
  code: string;
  name: string;
  description: string;
}

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

const EXHIBITOR_STAGES = [
  {
    stage: '01',
    title: 'Register your interest',
    dates: 'Oct 2026 – Jan 2027',
    description:
      'Contact your provincial society to express exhibitor interest. Early registration secures bench space and priority catalogue listing.',
  },
  {
    stage: '02',
    title: 'Confirm entry and classes',
    dates: 'Feb – Apr 2027',
    description:
      'Submit your entry form with plant list and class selections. Entries reviewed against current SAOC judging standards.',
  },
  {
    stage: '03',
    title: 'Staging and preparation',
    dates: 'Sep 17 2027',
    description:
      'Arrive at the CTICC from 07:00 for bench set-up. All plants must be in place and labelled by 17:00. Judging begins the following morning.',
  },
  {
    stage: '04',
    title: 'Judging and awards',
    dates: 'Sep 18–21 2027',
    description:
      'SAOC accredited judges assess each class over the first two days. Awards ceremony on the evening of Sep 20. Show open to the public throughout.',
  },
];

const CYCLE_YEARS = [
  { year: 2024, edition: 18, host: 'KwaZulu-Natal', status: 'past' as const },
  { year: 2027, edition: 19, host: 'Western Cape', status: 'current' as const },
  { year: 2030, edition: 20, host: 'TBC', status: 'future' as const },
];

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

export default async function NationalShowPage() {
  const [sanityClasses, sanityShows] = await Promise.all([
    sanityFetch<SanityShowClass[]>({ query: showClassesQuery, tags: ['showClass', 'sanity'] }),
    sanityFetch<SanityPastShow[]>({ query: pastShowsQuery, tags: ['show', 'sanity'] }),
  ]);

  const classes: ShowClass[] =
    sanityClasses && sanityClasses.length > 0
      ? sanityClasses.map((c) => ({ id: c._id, code: c.code, name: c.name, group: '', description: c.description }))
      : staticClasses;

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
      : staticShows.filter((s) => s.status === 'past').slice(0, 5);

  return (
    <>
      {/* ── Show Hero ── */}
      <section className="relative flex min-h-[760px] items-end overflow-hidden bg-primary-800">
        <Image
          src="/images/orchid-dark.jpg"
          alt="National Show bench of orchids"
          fill
          priority
          className="object-cover opacity-50"
          sizes="100vw"
        />
        {/* Diagonal sage → ink gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, var(--primary) 0%, var(--primary-800) 60%, #0a0f0a 100%)',
            opacity: 0.75,
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-[1280px] px-8 py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
            The Flagship
          </p>
          <p className="mt-2 font-mono text-[13px] uppercase tracking-[0.18em] text-ivory/60">
            {toRomanOrdinal(19)} · Nineteenth Edition
          </p>
          <h1 className="mt-4 max-w-[16ch] font-serif text-[clamp(42px,5.6vw,76px)] font-medium leading-[1.04] tracking-[-0.015em] text-ivory">
            The South African National{' '}
            <em className="not-italic text-accent-soft">Orchid Show</em>
          </h1>

          {/* 4-up meta grid */}
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Dates', value: '18–21 Sep 2027' },
              { label: 'Host', value: 'Western Cape' },
              { label: 'Venue', value: 'CTICC, Cape Town' },
              { label: 'Cycle', value: 'Triennial' },
            ].map(({ label, value }) => (
              <div key={label} className="border-l-2 border-accent/40 pl-4">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory/50">
                  {label}
                </dt>
                <dd className="mt-0.5 font-sans text-[15px] text-ivory">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Countdown */}
          <div className="mt-10">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory/40">
              Opens in
            </p>
            <Suspense fallback={null}>
              <ShowCountdown />
            </Suspense>
          </div>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="font-mono text-[11px] uppercase tracking-[0.18em] bg-accent px-6 py-3 text-ivory transition-colors duration-150 hover:bg-accent-soft"
            >
              Register interest →
            </Link>
            <Link
              href="/societies"
              className="font-mono text-[11px] uppercase tracking-[0.18em] border border-ivory/40 px-6 py-3 text-ivory transition-colors duration-150 hover:bg-ivory/10"
            >
              Find your society
            </Link>
          </div>
        </div>
      </section>

      {/* ── What it is ── */}
      <section className="mx-auto grid max-w-[1280px] grid-cols-1 gap-16 px-8 py-24 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            About the show
          </p>
          <h2 className="mt-3 font-serif text-[clamp(30px,3.8vw,46px)] font-medium leading-[1.1] text-ink">
            Three years in the making,{' '}
            <em className="not-italic text-primary-700">four days on the bench</em>
          </h2>
          <p className="mt-6 font-sans text-[16px] leading-relaxed text-ink/80">
            The SAOC National Orchid Show is the country&rsquo;s premier competitive orchid event.
            Held every three years, it rotates across South Africa&rsquo;s nine provinces, bringing
            together growers, hybridisers, judges and collectors for four days of competition,
            education, and community.
          </p>
          <p className="mt-4 font-sans text-[16px] leading-relaxed text-ink/80">
            Every plant is assessed by{' '}
            <Link href="/judging" className="underline underline-offset-2">
              accredited SAOC judges
            </Link>{' '}
            against the 100-point scale across ten botanical classes. The Grand Champion is the
            highest-scoring exhibit across all classes.
          </p>
        </div>

        {/* 4-up stats */}
        <div className="grid grid-cols-2 gap-px bg-rule">
          {[
            { value: '18', label: 'Editions held' },
            { value: '3 yr', label: 'Cycle' },
            { value: '10', label: 'Judging classes' },
            { value: '1,240', label: 'Entries — 2024' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-bone px-8 py-10">
              <div className="font-serif text-[48px] font-medium leading-none text-primary">
                {value}
              </div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Three-year cycle ── */}
      <section className="bg-bone py-20">
        <div className="mx-auto max-w-[1280px] px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            The rotation
          </p>
          <h2 className="mt-3 font-serif text-[clamp(26px,3vw,36px)] font-medium text-ink">
            Three-year cycle
          </h2>

          <div className="relative mt-12 grid grid-cols-3 gap-6">
            {/* Connecting rail */}
            <div className="absolute left-[calc(16.7%+1rem)] right-[calc(16.7%+1rem)] top-8 h-px bg-rule" />

            {CYCLE_YEARS.map(({ year, edition, host, status }) => (
              <div
                key={year}
                className={[
                  'relative flex flex-col gap-3 p-6',
                  status === 'current'
                    ? 'bg-primary text-ivory scale-105 shadow-lg'
                    : status === 'past'
                      ? 'bg-parchment border border-rule'
                      : 'bg-parchment border border-dashed border-rule',
                ].join(' ')}
              >
                {status === 'current' && (
                  <span className="self-start font-mono text-[10px] uppercase tracking-[0.18em] bg-accent text-ivory px-2 py-0.5">
                    Next
                  </span>
                )}
                {/* Brass dot on rail */}
                <div
                  className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2"
                  style={{
                    backgroundColor: status === 'current' ? 'var(--accent)' : 'var(--rule)',
                    borderColor: status === 'current' ? 'var(--accent)' : 'var(--rule)',
                  }}
                />
                <div
                  className={[
                    'font-serif text-[32px] font-medium leading-none',
                    status === 'current' ? 'text-ivory' : 'text-ink',
                  ].join(' ')}
                >
                  {year}
                </div>
                <div
                  className={[
                    'font-mono text-[11px] uppercase tracking-[0.14em]',
                    status === 'current' ? 'text-ivory/60' : 'text-muted',
                  ].join(' ')}
                >
                  Edition {toRomanOrdinal(edition)}
                </div>
                <div
                  className={[
                    'font-sans text-[14px]',
                    status === 'current' ? 'text-ivory/80' : 'text-ink/70',
                  ].join(' ')}
                >
                  {host}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 font-sans text-[13px] text-muted">
            Host province rotates among regional orchid societies nominated by the SAOC board.
          </p>
        </div>
      </section>

      {/* ── Classes & Judging ── */}
      <section className="mx-auto max-w-[1280px] px-8 py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Competition structure
        </p>
        <h2 className="mt-3 font-serif text-[clamp(26px,3vw,36px)] font-medium text-ink">
          Ten judging groups
        </h2>
        <p className="mt-4 max-w-2xl font-sans text-[15px] text-ink/70">
          Every exhibit is entered in one of ten botanical classes. Judges score on a 100-point
          scale covering cultural quality, presentation, and species accuracy.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {classes.map((cls) => (
            <div key={cls.id} className="flex flex-col gap-2 border border-rule bg-parchment p-5">
              <div className="flex h-10 w-10 items-center justify-center bg-primary">
                <span className="font-serif text-[15px] italic font-medium text-accent-soft">
                  {cls.code}
                </span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {cls.group || `Group ${classes.indexOf(cls) + 1}`}
              </p>
              <p className="font-serif text-[16px] font-medium leading-snug text-ink">
                {cls.name}
              </p>
              <p className="font-sans text-[13px] leading-snug text-ink/60">{cls.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Exhibitor information ── */}
      <section className="bg-primary py-24">
        <div className="mx-auto max-w-[1280px] px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            Entering the show
          </p>
          <h2 className="mt-3 font-serif text-[clamp(26px,3vw,36px)] font-medium text-ivory">
            Exhibitor information
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EXHIBITOR_STAGES.map(({ stage, title, dates, description }) => (
              <div
                key={stage}
                className="flex flex-col gap-3 p-6"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                  Stage {stage}
                </p>
                <h3 className="font-serif text-[20px] font-medium leading-snug text-ivory">
                  {title}
                </h3>
                <p className="font-mono text-[11px] tracking-[0.1em] text-ivory/50">{dates}</p>
                <p className="font-sans text-[14px] leading-relaxed text-ivory/70">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Past shows ── */}
      {pastShows.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-8 py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            Show history
          </p>
          <h2 className="mt-3 font-serif text-[clamp(26px,3vw,36px)] font-medium text-ink">
            Past editions
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pastShows.slice(0, 6).map((show) => (
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
                <div className="flex flex-col gap-3 p-5">
                  <div>
                    <p className="font-serif text-[20px] font-medium text-ink">
                      {show.year} — {show.month}
                    </p>
                    <p className="font-sans text-[14px] text-muted">{show.host}</p>
                  </div>
                  {(show.entries || show.visitors || show.trophies) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-rule">
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
        </section>
      )}

      {/* ── CTA band ── */}
      <section className="bg-bone py-20">
        <div className="mx-auto max-w-[1280px] px-8 text-center">
          <h2 className="font-serif text-[clamp(28px,3.6vw,44px)] font-medium text-ink">
            Start planning your entry now.
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-[16px] text-ink/70">
            The 19th National Orchid Show opens in September 2027 in Cape Town. Register your
            interest through your society or contact the council directly.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/societies"
              className="font-mono text-[11px] uppercase tracking-[0.18em] bg-primary px-6 py-3 text-ivory transition-colors duration-150 hover:bg-primary-800"
            >
              Find your society
            </Link>
            <Link
              href="/contact"
              className="font-mono text-[11px] uppercase tracking-[0.18em] border border-ink/30 px-6 py-3 text-ink transition-colors duration-150 hover:bg-ink/5"
            >
              Ask the council
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
