// =============================================================
// SAOC — components/show/TravelRoutes.tsx
// Server Component — maps over showVisitorInfo.airportRoutes.
// Travel guidance is data, not prose: this component knows nothing about any
// particular airport, distance or venue, and renders nothing when the array is empty.
// =============================================================

import type { TravelRoute } from '@/types';
import { COLUMN_CLASS, SPAN_CLASS, resolveGridLayout } from '@/lib/grid-columns';

export interface TravelRoutesProps {
  routes?: TravelRoute[] | null;
}

export function TravelRoutes({ routes }: TravelRoutesProps) {
  const entries = (routes ?? []).filter((route) => route?.origin);
  if (entries.length === 0) return null;

  // R13 — column count DERIVED from the rendered count, never a hardcoded class. See
  // .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/grid-orphan-rule.golden.md.
  const { columns, finalCardSpans } = resolveGridLayout(entries.length);
  const lastIndex = entries.length - 1;

  return (
    // No hardcoded column-count utility below lg: mobile/tablet stack via flex-col — the only
    // column-count class comes from lib/grid-columns.ts (D68).
    <ul className={`mt-6 flex flex-col gap-px bg-rule lg:grid ${COLUMN_CLASS[columns]}`}>
      {entries.map((route, index) => (
        <li
          key={route._key ?? `${route.origin}-${index}`}
          className={`bg-parchment p-6 ${
            index === lastIndex && finalCardSpans > 1 ? SPAN_CLASS[finalCardSpans] : ''
          }`}
        >
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
