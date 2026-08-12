// =============================================================
// SAOC — components/show/AccommodationList.tsx
// Server Component — groups showVisitorInfo.accommodation by distance band.
//
// Band ORDER and band LABELS are presentation, not editor content, so they are a
// constant here. They carry no venue-derived value: "under 1 km from the venue" stays
// true whichever venue the committee confirms.
//
// No price, rating or negotiated-rate is rendered because none is modelled — SAOC has
// no arrangement with any property and must not appear to have one.
// =============================================================

import type { AccommodationDistanceBand, AccommodationOption } from '@/types';

const BAND_ORDER: AccommodationDistanceBand[] = ['walking', 'nearby', 'city', 'further'];

const BAND_LABELS: Record<AccommodationDistanceBand, string> = {
  walking: 'Walking distance — under 1 km',
  nearby: 'Nearby — 1 to 3 km',
  city: 'Wider city — 3 to 10 km',
  further: 'Further out — over 10 km',
};

function bandOf(option: AccommodationOption): AccommodationDistanceBand {
  const band = option.distanceBand;
  return band && BAND_ORDER.includes(band) ? band : 'nearby';
}

export interface AccommodationListProps {
  options?: AccommodationOption[] | null;
}

export function AccommodationList({ options }: AccommodationListProps) {
  const entries = (options ?? []).filter((option) => option?.name);
  if (entries.length === 0) return null;

  return (
    <div className="mt-6 space-y-8">
      {BAND_ORDER.map((band) => {
        const inBand = entries.filter((option) => bandOf(option) === band);
        if (inBand.length === 0) return null;

        return (
          <section key={band}>
            <h4 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              {BAND_LABELS[band]}
            </h4>
            <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {inBand.map((option, index) => (
                <li
                  key={option._key ?? `${option.name}-${index}`}
                  className="border border-rule bg-parchment p-5"
                >
                  <p className="font-serif text-[18px] font-medium text-ink">{option.name}</p>
                  {option.area ? (
                    <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                      {option.area}
                    </p>
                  ) : null}
                  {option.note ? (
                    <p className="mt-2 font-sans text-[14px] leading-relaxed text-ink/70">
                      {option.note}
                    </p>
                  ) : null}
                  {option.url ? (
                    <a
                      href={option.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-block font-sans text-[13px] text-ink underline underline-offset-2 hover:text-accent"
                    >
                      Visit website ↗
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
