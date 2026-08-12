// =============================================================
// SAOC — components/show/TravelRoutes.tsx
// Server Component — maps over showVisitorInfo.airportRoutes.
// Travel guidance is data, not prose: this component knows nothing about any
// particular airport, distance or venue, and renders nothing when the array is empty.
// =============================================================

import type { TravelRoute } from '@/types';

export interface TravelRoutesProps {
  routes?: TravelRoute[] | null;
}

export function TravelRoutes({ routes }: TravelRoutesProps) {
  const entries = (routes ?? []).filter((route) => route?.origin);
  if (entries.length === 0) return null;

  return (
    <ul className="mt-6 grid grid-cols-1 gap-px bg-rule md:grid-cols-3">
      {entries.map((route, index) => (
        <li key={route._key ?? `${route.origin}-${index}`} className="bg-parchment p-6">
          <h4 className="font-serif text-[19px] font-medium leading-snug text-ink">
            {route.origin}
          </h4>

          {route.distance || route.duration ? (
            <dl className="mt-3 space-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              {route.distance ? (
                <div className="flex gap-2">
                  <dt>Distance</dt>
                  <dd className="text-ink/70">{route.distance}</dd>
                </div>
              ) : null}
              {route.duration ? (
                <div className="flex gap-2">
                  <dt>Time</dt>
                  <dd className="text-ink/70">{route.duration}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {route.directions ? (
            <p className="mt-3 font-sans text-[15px] leading-relaxed text-ink/80">
              {route.directions}
            </p>
          ) : null}

          {route.transportOptions && route.transportOptions.length > 0 ? (
            <ul className="mt-3 space-y-2 border-t border-rule pt-3">
              {route.transportOptions.map((option) => (
                <li key={option} className="font-sans text-[14px] leading-relaxed text-ink/70">
                  {option}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
