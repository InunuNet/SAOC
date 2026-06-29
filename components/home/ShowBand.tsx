'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';

import { useCountdown } from '@/lib/hooks/useCountdown';

const SHOW_META = [
  { label: 'Dates', value: 'September 2027' },
  { label: 'Host Region', value: 'Western Cape' },
  { label: 'Venue', value: 'Cape Town International Convention Centre' },
  { label: 'Duration', value: '4 days' },
] as const;

const DEFAULT_COUNTDOWN_DATE = '2027-09-18T09:00:00+02:00';

export interface ShowBandProps {
  countdownDate?: string | null;
}

export function ShowBand({ countdownDate }: ShowBandProps) {
  const TARGET = useMemo(() => {
    const candidate = countdownDate ? new Date(countdownDate) : null;
    return candidate && !isNaN(candidate.getTime())
      ? candidate
      : new Date(DEFAULT_COUNTDOWN_DATE);
  }, [countdownDate]);
  const { days, hours, minutes, seconds } = useCountdown(TARGET);

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
          {/* Eyebrow */}
          <div className="mb-6">
            <span className="eyebrow eyebrow--light">Flagship Event</span>
          </div>

          {/* Headline — no italic, all white */}
          <h2 className="font-serif text-[clamp(32px,3.8vw,48px)] font-medium leading-[1.1] tracking-[-0.01em] text-ivory mb-8">
            The 19th South African National Orchid Show
          </h2>

          {/* Meta grid */}
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8">
            {SHOW_META.map((item) => (
              <div key={item.label}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ivory/50 mb-1">
                  {item.label}
                </dt>
                <dd className="font-sans text-[15px] text-ivory">{item.value}</dd>
              </div>
            ))}
          </dl>

          {/* Countdown — contained box */}
          <div className="bg-primary/40 border border-ivory/10 px-6 py-5 mb-8">
            <div className="flex gap-8">
              {(
                [
                  { value: days, label: 'Days' },
                  { value: hours, label: 'Hours' },
                  { value: minutes, label: 'Minutes' },
                  { value: seconds, label: 'Seconds' },
                ] as const
              ).map((cell) => (
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

          {/* CTAs */}
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
