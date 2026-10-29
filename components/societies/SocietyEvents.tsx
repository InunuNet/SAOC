// =============================================================
// SAOC — components/societies/SocietyEvents.tsx
// Server Component — upcoming events hosted by this society, or one line and the calendar link
// (not a boxed empty state) when none are scheduled.
// =============================================================

import Link from 'next/link';

import { EventCard } from '@/components/events';
import type { SanityEvent } from '@/types';
import { ArrowIcon } from '@/components/ui/ArrowIcon';

export interface SocietyEventsProps {
  societyName: string;
  events: SanityEvent[];
}

export function SocietyEvents({ societyName, events }: SocietyEventsProps) {
  return (
    <section>
      <h2 className="doc-h2">Upcoming events</h2>
      {events.length > 0 ? (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event._id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="max-w-[60ch] font-sans text-[16px] leading-[1.55] text-ink/80">
          {societyName} has no upcoming events listed yet.{' '}
          <Link href="/events" className="inline-link inline-flex min-h-6 items-center font-medium text-ink outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]">
            View the SAOC events calendar<ArrowIcon />
          </Link>
        </p>
      )}
    </section>
  );
}
