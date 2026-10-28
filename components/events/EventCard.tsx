import Link from 'next/link';
import { useId } from 'react';

import { eventDateBlock } from '@/lib/events-list';
import type { SanityEvent } from '@/types';
import { ArrowIcon } from '@/components/ui/ArrowIcon';

/** An invented event on the beta preview carries `isPlaceholder`; the page notes it once above the list and never links it. */
export type ListedEvent = SanityEvent & { isPlaceholder?: boolean };

export interface EventCardProps {
  event: ListedEvent;
}

// Handoff event-row grid (110px 1fr auto auto), stacked to a date + content pair below 768.
// Focus and hover are a title underline plus a 2px left bar (NAV-1 family): no box, no ring, no tint,
// so the link's own outline is dropped in favour of those two cues.
const ROW_CLASSES = [
  'relative grid min-h-11 grid-cols-[88px_1fr] items-start gap-x-5 border-b border-rule py-5 outline-none',
  'md:grid-cols-[110px_1fr_auto_auto] md:items-center md:gap-x-7 md:py-[22px]',
].join(' ');

const BAR_CLASSES = [
  'before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-primary before:opacity-0',
  'before:transition-opacity before:duration-150 motion-reduce:before:transition-none',
  'hover:before:opacity-100 focus-visible:before:opacity-100',
].join(' ');

// r16 F3 (Codi): the whole row is one link to /events/<slug>, named by the event title alone and
// described by the visible date and venue; the host society is plain text inside it, so nothing
// interactive nests in or beside the row link. An event without a slug renders unlinked, never as
// a link to a page that does not exist.
export function EventCard({ event }: EventCardProps) {
  const { d, m, y } = eventDateBlock(event.date, event.endDate);
  const id = useId();
  const titleId = `${id}-title`;
  const dateId = `${id}-date`;
  const venueId = `${id}-venue`;
  const linked = Boolean(event.slug) && !event.isPlaceholder;
  const locationInVenue = event.venue && event.location && event.venue.includes(event.location);
  const venueLine = [event.venue, locationInVenue ? null : event.location].filter(Boolean).join(', ');

  const content = (
    <>
      {/* Date block: the 2px accent rule is its left border */}
      <time
        id={dateId}
        dateTime={event.date}
        className="flex flex-col border-l-2 border-accent pl-4 leading-none"
      >
        <span className="whitespace-nowrap font-serif text-[36px] font-normal leading-none text-primary">{d}</span>
        <span className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {m}
        </span>
        <span className="mt-0.5 font-mono text-[10.5px] tracking-[0.14em] text-muted">{y}</span>
      </time>

      <div className="min-w-0">
        <span
          id={titleId}
          data-corner-title
          className={`block font-serif text-[22px] font-semibold leading-snug text-primary${
            linked ? ' underline-offset-4 decoration-2 group-hover:underline group-focus-visible:underline' : ''
          }`}
        >
          {event.title}
        </span>
        {venueLine ? (
          <p id={venueId} className="mt-1 font-sans text-[13.5px] text-ink/70">
            {venueLine}
          </p>
        ) : null}
      </div>

      {event.hostSociety ? (
        <p className="col-start-2 mt-2 max-w-[200px] font-mono text-[11px] uppercase tracking-[0.14em] text-muted md:col-start-3 md:mt-0 md:text-right">
          <span className="sr-only">Host society</span> {event.hostSociety.name}
        </p>
      ) : null}

      {linked ? (
        <span
          aria-hidden="true"
          className="hidden font-serif text-[20px] text-primary md:col-start-4 md:block"
        >
          <ArrowIcon variant="corner" />
        </span>
      ) : null}
    </>
  );

  return (
    <article>
      {linked ? (
        <Link
          data-event-row
          data-variant="corner"
          href={`/events/${event.slug}`}
          aria-labelledby={titleId}
          aria-describedby={venueLine ? `${dateId} ${venueId}` : dateId}
          className={`group ${ROW_CLASSES} ${BAR_CLASSES}`}
        >
          {content}
        </Link>
      ) : (
        <div data-event-row className={ROW_CLASSES}>
          {content}
        </div>
      )}
    </article>
  );
}
