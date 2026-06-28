import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { shows as staticShows } from '@/lib/data/shows';

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

export async function generateStaticParams() {
  return staticShows
    .filter((s) => s.status === 'past')
    .map((s) => ({ year: String(s.year) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  const show = staticShows.find((s) => String(s.year) === year);
  if (!show) return { title: `National Show ${year}` };
  return {
    title: `${year} National Orchid Show — ${show.host}`,
    description: `The ${toRomanOrdinal(show.edition)} South African National Orchid Show, held in ${show.month} ${show.year} in ${show.host}.`,
  };
}

export default async function ShowYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const show = staticShows.find((s) => String(s.year) === year);

  if (!show || show.status !== 'past') notFound();

  const pastShows = staticShows.filter((s) => s.status === 'past');
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
            Edition {toRomanOrdinal(show.edition)} · {show.year}
          </p>
          <h1 className="font-serif text-[clamp(36px,4.8vw,64px)] font-medium leading-[1.06] tracking-[-0.012em] text-ivory max-w-[18ch]">
            The {show.year} South African National{' '}
            <em className="not-italic text-accent-soft">Orchid Show</em>
          </h1>
          <p className="mt-5 font-sans text-[17px] text-ivory/70">
            {show.month} {show.year} · {show.venue} · {show.host}
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-bone">
        <div className="mx-auto max-w-[1280px] px-8 py-16">
          <div className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
            {[
              { value: toRomanOrdinal(show.edition), label: 'Edition' },
              { value: show.days ? `${show.days} days` : '—', label: 'Duration' },
              {
                value: show.entries ? show.entries.toLocaleString() : '—',
                label: 'Entries',
              },
              {
                value: show.visitors ? show.visitors.toLocaleString() : '—',
                label: 'Visitors',
              },
            ].map(({ value, label }) => (
              <div key={label} className="bg-bone px-8 py-10">
                <div className="font-serif text-[42px] font-medium leading-none text-primary">
                  {value}
                </div>
                <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
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
              The {toRomanOrdinal(show.edition)} National Orchid Show was held in {show.month}{' '}
              {show.year} at {show.venue}, hosted by the orchid societies of {show.host}.
              {show.trophies ? ` ${show.trophies} trophies and awards were presented.` : ''}
            </p>
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
                {prevShow.year} — {prevShow.host}
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
                {nextShow.year} — {nextShow.host}
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
            Next up: the 19th Show, Cape Town 2027
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/national-show"
              className="font-mono text-[11px] uppercase tracking-[0.18em] bg-primary px-6 py-3 text-ivory transition-colors duration-150 hover:bg-primary-800"
            >
              View 19th Show
            </Link>
            <Link
              href="/national-show/archive"
              className="font-mono text-[11px] uppercase tracking-[0.18em] border border-ink/30 px-6 py-3 text-ink transition-colors duration-150 hover:bg-ink/5"
            >
              Full archive
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
