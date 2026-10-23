import Link from 'next/link';
import { useId } from 'react';

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import type { SanityEvent } from '@/types';

const EVENT_PLACEHOLDER_LABEL = "AI event: waiting on SAOC's official events";

/** An invented event on the beta preview carries `isPlaceholder`; it is marked and never linked. */
export type ListedEvent = SanityEvent & { isPlaceholder?: boolean };

export interface EventCardProps {
  event: ListedEvent;
}

const CARD_CLASSES = 'flex gap-5 border border-rule bg-parchment px-5 py-4 transition hover:bg-bone';

function formatDateLabel(dateStr: string): { day: string; month: string } {
  const date = new Date(dateStr);
  return {
    day: date.getUTCDate().toString(),
    month: date.toLocaleString('en-ZA', { month: 'short', timeZone: 'UTC' }),
  };
}

// r16 F3 (Codi): the whole card is one link to /events/<slug>, named by the event title alone and
// described by the visible date and venue; the host society is plain text inside it, so nothing
// interactive nests in or beside the row link. An event without a slug renders unlinked, never as
// a link to a page that does not exist.
export function EventCard({ event }: EventCardProps) {
  const { day, month } = formatDateLabel(event.date);
  const id = useId();
  const titleId = `${id}-title`;
  const dateId = `${id}-date`;
  const venueId = `${id}-venue`;
  const linked = Boolean(event.slug) && !event.isPlaceholder;

  const content = (
    <>
      {/* Date column */}
      <time
        id={dateId}
        dateTime={event.date}
        className="flex w-12 shrink-0 flex-col items-center justify-start pt-0.5"
      >
        <span className="font-serif font-normal text-[28px] leading-none text-primary">{day}</span>
        <span className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {month}
        </span>
      </time>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <span
            id={titleId}
            className={`font-serif font-medium text-[18px] leading-snug text-ink${
              linked ? ' group-hover:underline group-focus-visible:underline' : ''
            }`}
          >
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
              <dd id={venueId}>{event.venue}</dd>
            </div>
          ) : null}
        </dl>
        {event.isPlaceholder ? <PlaceholderMarker label={EVENT_PLACEHOLDER_LABEL} /> : null}
      </div>
    </>
  );

  return (
    <article>
      {linked ? (
        <Link
          href={`/events/${event.slug}`}
          aria-labelledby={titleId}
          aria-describedby={event.venue ? `${dateId} ${venueId}` : dateId}
          className={`group ${CARD_CLASSES}`}
        >
          {content}
        </Link>
      ) : (
        <div className={CARD_CLASSES}>{content}</div>
      )}
    </article>
  );
}
