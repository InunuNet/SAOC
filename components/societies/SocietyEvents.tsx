// =============================================================
// SAOC — components/societies/SocietyEvents.tsx
// Server Component — upcoming events hosted by this society, or a
// designed empty state (not a blank gap) when none are scheduled.
//
// `live` distinguishes real Sanity events (safe to link to their own
// `/events/[slug]` detail page) from the static-data fallback used when
// Sanity has nothing for this society: those fallback events have a
// slugified-title `slug` with no corresponding page — `/events/[slug]`
// has no static-data fallback of its own and calls `notFound()` for any
// slug Sanity doesn't recognise. Rendering a fallback event as a plain,
// non-linking row (instead of reusing EventCard's title Link) means a
// fallback card can never point at a route that doesn't resolve.
// =============================================================

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';

import { EventCard } from '@/components/events';
import type { SanityEvent } from '@/types';

export interface SocietyEventsProps {
  societyName: string;
  events: SanityEvent[];
  /** False when `events` came from the static-data fallback rather than Sanity. */
  live: boolean;
}

function formatEventDate(dateStr: string): { day: string; month: string } {
  const date = new Date(dateStr);
  return {
    day: date.getUTCDate().toString(),
    month: date.toLocaleString('en-ZA', { month: 'short', timeZone: 'UTC' }),
  };
}

/** Non-linking rendering of a fallback-sourced event — visually consistent with
 * EventCard, but with no link to a `/events/[slug]` page that cannot resolve. */
function FallbackEventRow({ event }: { event: SanityEvent }) {
  const { day, month } = formatEventDate(event.date);
  return (
    <article className="flex gap-5 border border-rule bg-parchment px-5 py-4">
      <div
        className="flex w-12 shrink-0 flex-col items-center justify-start pt-0.5"
        aria-hidden="true"
      >
        <span className="font-serif text-[28px] font-medium leading-none text-primary">{day}</span>
        <span className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {month}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <p className="font-serif text-[18px] font-semibold leading-snug text-ink">
            {event.title}
          </p>
          {event.kind ? (
            <span
              className="mt-0.5 shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ backgroundColor: 'var(--bone)', color: 'var(--accent)' }}
            >
              {event.kind}
            </span>
          ) : null}
        </div>
        {event.venue ? (
          <p className="mt-1.5 font-sans text-[13px] text-ink/70">{event.venue}</p>
        ) : null}
      </div>
    </article>
  );
}

export function SocietyEvents({ societyName, events, live }: SocietyEventsProps) {
  return (
    <section>
      <span className="eyebrow">Upcoming events</span>
      {events.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {events.map((event) => (
            <li key={event._id}>
              {live ? <EventCard event={event} /> : <FallbackEventRow event={event} />}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 flex flex-col items-start gap-3 border border-dashed border-rule bg-bone/60 px-6 py-10">
          <CalendarDays size={22} className="text-muted" aria-hidden />
          <p className="max-w-md font-sans text-[15px] leading-relaxed text-ink/70">
            {societyName} has no upcoming events listed yet. Check the full SAOC calendar for
            shows and workshops across every affiliated society.
          </p>
          <Link href="/events" className="inline-link font-sans text-[14px] font-medium text-ink">
            View the SAOC events calendar →
          </Link>
        </div>
      )}
    </section>
  );
}
