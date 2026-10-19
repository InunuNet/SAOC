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

// r16 F3 (Codi): the whole card is one link to /events/<slug>, named by the event title alone; the
// host society is plain text inside it, so nothing interactive nests in or beside the row link.
export function EventCard({ event }: EventCardProps) {
  const { day, month } = formatDateLabel(event.date);

  return (
    <article>
      <Link
        href={`/events/${event.slug}`}
        aria-label={event.title}
        className="flex gap-5 border border-rule bg-parchment px-5 py-4 transition hover:bg-bone"
      >
        {/* Date column */}
        <time
          dateTime={event.date}
          className="flex w-12 shrink-0 flex-col items-center justify-start pt-0.5"
        >
          <span className="font-serif text-[28px] font-medium leading-none text-primary">{day}</span>
          <span className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {month}
          </span>
        </time>

        {/* Content column */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <span className="font-serif text-[18px] font-semibold leading-snug text-ink">
              {event.title}
            </span>
            {event.kind ? (
              <span
                className="mt-0.5 shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                style={{ backgroundColor: 'var(--bone)', color: 'var(--muted)' }}
              >
                {event.kind}
              </span>
            ) : null}
          </div>

          <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-sans text-[13px] text-ink/70">
            {event.hostSociety ? (
              <div className="flex gap-1">
                <dt className="sr-only">Host society</dt>
                <dd>{event.hostSociety.name}</dd>
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
      </Link>
    </article>
  );
}
