'use client';

import Image from 'next/image';
import { useMemo } from 'react';

import { useCountdown } from '@/lib/hooks/useCountdown';
import { nosUrl } from '@/lib/site-hosts';
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

const BOX_CLASSES = 'bg-ivory/8 p-[2px] rounded-[2px] mb-8';

export interface ShowBandProps {
  show?: ShowIdentity | null;
  /** Overrides only the "Show details" href (the /events page points it at the show's event page). */
  detailsHref?: string;
  /** False where the page already carries a photograph above the fold (/events): the band is its text panel alone. */
  showPhoto?: boolean;
  /**
   * "event" is the National Show event page's 42/58 photo-to-copy split from 1025px up (NOS Design). The
   * home page and /events keep the default 1fr/1.1fr split from 1100px.
   */
  split?: 'event';
}

/** The dark-orchid cut (lib/hero-derived-sources.json, orchid-dark-showband): its sharp left cluster fills the box. */
const PHOTO_OBJECT_POSITION = '50% 50%';

// Tailwind needs whole class names, so each split carries its full set. `sizes` is the photo column's
// slot: the 2400-wide cut covers a box up to 1200 css wide at 2x; below the side-by-side breakpoint the
// 3/2 block is width-driven, so 100vw is right.
const SPLITS = {
  default: {
    grid: 'grid grid-cols-1 min-[1100px]:grid-cols-[1fr_1.1fr] min-[1100px]:min-h-[620px]',
    photo: 'relative w-full aspect-[3/2] min-[1100px]:aspect-auto min-[1100px]:min-h-[620px]',
    copy: 'flex flex-col justify-center px-8 py-[60px] min-[1100px]:px-20 min-[1100px]:py-[90px] on-dark',
    sizes: '(min-width: 1100px) 1200px, 100vw',
  },
  event: {
    grid: 'grid grid-cols-1 min-[1025px]:grid-cols-[42fr_58fr] min-[1025px]:min-h-[620px]',
    photo: 'relative w-full aspect-[3/2] min-[1025px]:aspect-auto min-[1025px]:min-h-[620px]',
    copy: 'flex flex-col justify-center px-8 py-[60px] min-[1025px]:px-20 min-[1025px]:py-[90px] on-dark',
    sizes: '(min-width: 1025px) 1200px, 100vw',
  },
} as const;

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
      <p
        data-show-band-countdown
        className={`${BOX_CLASSES} px-6 py-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/65`}
      >
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
    <div
      data-show-band-countdown
      role="group"
      aria-label={`Countdown to the ${showLabelWithEdition(edition)}`}
      className={`${BOX_CLASSES} @container`}
    >
      <div className="grid grid-cols-4 @max-[360px]:grid-cols-2 gap-[2px]">
      {cells.map((cell) => (
        <div
          key={cell.label}
          data-countdown-cell
          className="min-w-0 bg-ivory/4 rounded-[1px] px-1.5 sm:px-3 py-[18px] text-center"
        >
          <div
            data-countdown-value
            className="font-serif tracking-[-0.015em] font-light text-[34px] sm:text-[42px] leading-none text-accent-soft tabular-nums"
          >
            {cell.value}
          </div>
          <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/65">
            {cell.label}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

export function ShowBand({ show, detailsHref, showPhoto = true, split }: ShowBandProps) {
  const layout = SPLITS[split ?? 'default'];
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
    <section data-home-section="show-band" className="bg-primary-800">
      <div
        className={showPhoto ? layout.grid : 'grid grid-cols-1'}
      >
        {/* Photo: flush to the viewport edge, no scrim (no text sits on it) */}
        {showPhoto ? (
          <div data-show-band-image className={layout.photo}>
            <Image
              src="/images/orchid-dark-showband.jpg"
              alt="Dark orchid on the show bench"
              fill
              className="object-cover"
              style={{ objectPosition: PHOTO_OBJECT_POSITION }}
              sizes={layout.sizes}
              quality={88}
            />
          </div>
        ) : null}

        <div
          className={
            showPhoto
              ? layout.copy
              : 'saoc-container w-full flex flex-col justify-center py-[60px] min-[1100px]:py-20 on-dark'
          }
        >
          <div data-show-band-content className="w-full max-w-[720px]">
            <div className="mb-6">
              <span className="eyebrow eyebrow--light">Flagship Event</span>
            </div>

            <h2 className="font-serif font-light text-[clamp(32px,3.8vw,48px)] leading-[1.1] tracking-[-0.015em] text-ivory mb-8 text-balance">
              {showTitleWithEdition(show?.edition, 'National Orchid Show')}
            </h2>

            <dl data-show-band-facts className="grid grid-cols-2 gap-x-10 gap-y-5 mb-8">
              {meta.map((item) => (
                <div key={item.label} className="border-t border-ivory/15 pt-3">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/65 mb-1">
                    {item.label}
                  </dt>
                  <dd className="font-sans text-[16px] leading-[1.55] text-ivory">{item.value}</dd>
                </div>
              ))}
            </dl>

            <CountdownBox target={target} edition={show?.edition} />

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={nosUrl('/tickets')}
                data-show-band-cta="primary"
                className="inline-flex items-center justify-center text-[14px] font-medium tracking-[0.01em] rounded-[2px] border transition-[translate,background-color,border-color,color,text-decoration-color] duration-150 ease-(--ease) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px] motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 px-[22px] py-[14px] max-[559px]:w-full border-transparent bg-accent text-ink hover:bg-accent-soft hover:-translate-y-px focus-visible:-translate-y-px active:translate-y-0"
              >
                Book tickets
              </a>
              <a
                href={detailsHref ?? nosUrl('/')}
                data-show-band-cta="secondary"
                className="inline-flex items-center justify-center text-[14px] font-medium tracking-[0.01em] rounded-[2px] border transition-[translate,background-color,border-color,color,text-decoration-color] duration-150 ease-(--ease) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px] motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 px-[22px] py-[14px] text-ivory border-ivory/45 hover:border-ivory hover:bg-white/6 hover:-translate-y-px focus-visible:-translate-y-px active:translate-y-0"
              >
                Show details
              </a>
              <a
                href={nosUrl('/award-entries')}
                data-show-band-cta="tertiary"
                className="inline-flex items-center justify-center text-[14px] font-medium tracking-[0.01em] rounded-[2px] border transition-[translate,background-color,border-color,color,text-decoration-color] duration-150 ease-(--ease) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px] motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 min-h-[44px] px-1 border-transparent text-ivory underline decoration-accent decoration-1 underline-offset-4 hover:text-accent-soft hover:decoration-accent-soft"
              >
                Award Entries
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
