import Link from 'next/link';
import { useId } from 'react';

import type { SocietyEvent } from '@/types';

interface EventRowProps {
  event: SocietyEvent;
}

const ROW_CLASSES = [
  'flex items-stretch gap-0',
  'transition-[padding,background] duration-150',
  'hover:bg-bone/60 hover:pl-1',
  'outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]',
].join(' ');

export function EventRow({ event }: EventRowProps) {
  const d = new Date(event.date);
  const day = d.getUTCDate().toString();
  const month = d.toLocaleDateString('en-ZA', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const year = d.getUTCFullYear().toString();
  const id = useId();
  const titleId = `${id}-title`;
  const dateId = `${id}-date`;
  const venueId = `${id}-venue`;
  const linked = Boolean(event.slug);

  const content = (
    <>
      {/* Date block */}
      <div
        id={dateId}
        className="flex flex-col items-center justify-center w-[110px] shrink-0 py-5 border-l-[3px]"
        style={{ borderLeftColor: 'var(--accent)' }}
      >
        <span className="font-serif tracking-[-0.015em] font-light text-[32px] leading-none text-primary">{day}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mt-1">
          {month}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {year}
        </span>
      </div>

      {/* Middle: kind, title, venue */}
      <div className="flex flex-col justify-center flex-1 px-6 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
          {event.kind}
        </p>
        <p id={titleId} className="font-serif font-normal text-[20px] text-primary leading-snug">
          {event.title}
        </p>
        <p id={venueId} className="font-sans text-[14px] text-ink/70 mt-1">
          {event.venue}
        </p>
      </div>

      {/* Right: host (hidden when empty) + arrow (only on a linked row) */}
      <div className="flex items-center gap-4 pr-5 shrink-0">
        {event.host && (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted hidden sm:block">
            {event.host}
          </span>
        )}
        {linked && (
          <span className="font-serif font-medium text-[18px] text-primary" aria-hidden="true">
            →
          </span>
        )}
      </div>
    </>
  );

  // r16 F3 (Codi): the whole row is one link to the event page, named by the event title alone and
  // described by the visible date and venue. A row without a slug renders unlinked and without
  // the arrow, so nothing points at a page that does not exist.
  return (
    <article className="border-b border-rule">
      {linked ? (
        <Link
          href={`/events/${event.slug}`}
          aria-labelledby={titleId}
          aria-describedby={event.venue ? `${dateId} ${venueId}` : dateId}
          className={ROW_CLASSES}
        >
          {content}
        </Link>
      ) : (
        <div className={ROW_CLASSES}>{content}</div>
      )}
    </article>
  );
}
