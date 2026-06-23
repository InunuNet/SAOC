import Link from 'next/link';

import type { SanityEvent } from '@/types';

export interface EventCardProps {
  event: SanityEvent;
}

function formatDateLabel(dateStr: string): { day: string; month: string } {
  const date = new Date(dateStr);
  return {
    day: date.getUTCDate().toString(),
    month: date.toLocaleString('en-ZA', { month: 'short', timeZone: 'UTC' }),
  };
}

export function EventCard({ event }: EventCardProps) {
  const { day, month } = formatDateLabel(event.date);

  return (
    <article className="flex gap-5 border border-rule bg-parchment px-5 py-4 transition hover:bg-bone">
      {/* Date column */}
      <div
        className="flex w-12 shrink-0 flex-col items-center justify-start pt-0.5"
        aria-hidden="true"
      >
        <span className="font-serif text-[28px] font-medium leading-none text-primary">{day}</span>
        <span className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {month}
        </span>
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <Link
            href={`/events/${event.slug}`}
            className="font-serif text-[18px] font-semibold leading-snug text-ink hover:underline"
          >
            {event.title}
          </Link>
          {event.kind ? (
            <span
              className="mt-0.5 shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ backgroundColor: 'var(--bone)', color: 'var(--accent)' }}
            >
              {event.kind}
            </span>
          ) : null}
        </div>

        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-sans text-[13px] text-ink/70">
          {event.hostSociety ? (
            <div className="flex gap-1">
              <dt className="sr-only">Host society</dt>
              <dd>
                <Link
                  href={`/societies/${event.hostSociety.slug}`}
                  className="hover:text-ink hover:underline"
                >
                  {event.hostSociety.name}
                </Link>
              </dd>
            </div>
          ) : null}
          {event.venue ? (
            <div className="flex gap-1">
              <dt className="sr-only">Venue</dt>
              <dd>{event.venue}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </article>
  );
}
