'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';

import { useCountdown } from '@/lib/hooks/useCountdown';
import { formatShowDateRange, showLabelWithEdition, showTitleWithEdition } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';

// F7: the home band is the most-seen show-identity surface on the site and it carried
// the venue, the dates, the host region and the countdown target as module constants —
// so @qa's venue swap in Studio left it advertising the old venue. Every fact here now
// comes from the nationalShow singleton, and an absent fact renders as absent rather
// than as a plausible invention. See show-identity-surfaces.golden.md.
const TBC = 'To be confirmed';

// useCountdown needs a Date; the epoch yields all-zeroes, and the countdown box is not
// rendered at all in that case. There is deliberately no fallback show date.
const NO_TARGET = new Date(0);

const MS_PER_DAY = 86_400_000;

const BOX_CLASSES = 'bg-primary/40 border border-ivory/10 px-6 py-5 mb-8';

export interface ShowBandProps {
  show?: ShowIdentity | null;
}

/** Inclusive day count across the show, derived from the dataset — never a literal. */
function formatDuration(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null;
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const days = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
  if (days < 1) return null;
  return days === 1 ? '1 day' : `${days} days`;
}

function CountdownBox({ target, edition }: { target: Date | null; edition?: number | null }) {
  const { days, hours, minutes, seconds } = useCountdown(target ?? NO_TARGET);

  if (!target) {
    return (
      <p className={`${BOX_CLASSES} font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/60`}>
        Show dates to be confirmed
      </p>
    );
  }

  const cells = [
    { value: days, label: 'Days' },
    { value: hours, label: 'Hours' },
    { value: minutes, label: 'Minutes' },
    { value: seconds, label: 'Seconds' },
  ];

  return (
    <div className={BOX_CLASSES}>
      <div
        className="flex gap-8"
        aria-label={`Countdown to the ${showLabelWithEdition(edition)}`}
      >
        {cells.map((cell) => (
          <div key={cell.label} className="flex flex-col items-center">
            <span className="font-serif text-[42px] text-accent-soft leading-none">
              {cell.value}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/60 mt-1">
              {cell.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShowBand({ show }: ShowBandProps) {
  const countdownDate = show?.countdownDate ?? null;
  const target = useMemo(() => {
    const candidate = countdownDate ? new Date(countdownDate) : null;
    return candidate && !Number.isNaN(candidate.getTime()) ? candidate : null;
  }, [countdownDate]);

  const meta = [
    { label: 'Dates', value: formatShowDateRange(show?.showDate, show?.showEndDate) ?? TBC },
    { label: 'Host Region', value: show?.hostRegion || TBC },
    { label: 'Venue', value: show?.venue?.name || show?.location || TBC },
    { label: 'Duration', value: formatDuration(show?.showDate, show?.showEndDate) ?? TBC },
  ];

  return (
    <section className="bg-primary-800">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2">
        {/* Image left */}
        <div className="relative aspect-[4/3] md:aspect-auto min-h-[400px]">
          <Image
            src="/images/orchid-yellow.jpg"
            alt="Yellow orchid on the show bench"
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-transparent to-primary-800/60 hidden md:block"
          />
        </div>

        {/* Content right */}
        <div className="flex flex-col justify-center px-10 py-16 on-dark">
          <div className="mb-6">
            <span className="eyebrow eyebrow--light">Flagship Event</span>
          </div>

          <h2 className="font-serif text-[clamp(32px,3.8vw,48px)] font-medium leading-[1.1] tracking-[-0.01em] text-ivory mb-8">
            {showTitleWithEdition(show?.edition, 'South African National Orchid Show')}
          </h2>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8">
            {meta.map((item) => (
              <div key={item.label}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ivory/50 mb-1">
                  {item.label}
                </dt>
                <dd className="font-sans text-[15px] text-ivory">{item.value}</dd>
              </div>
            ))}
          </dl>

          <CountdownBox target={target} edition={show?.edition} />

          <div className="flex flex-wrap gap-4">
            <Link
              href="/national-show"
              className="font-sans text-[14px] font-medium bg-accent text-ivory px-6 py-3 hover:bg-accent-soft transition-colors duration-150"
            >
              Show details
            </Link>
            <Link
              href="/national-show/exhibitors"
              className="font-sans text-[14px] font-medium border border-ivory/30 text-ivory px-6 py-3 hover:bg-ivory/10 transition-colors duration-150"
            >
              Exhibitor info
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
