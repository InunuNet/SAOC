// =============================================================
// SAOC — components/societies/SocietyEvents.tsx
// Server Component — upcoming events hosted by this society, or a
// designed empty state (not a blank gap) when none are scheduled.
// =============================================================

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';

import { EventCard } from '@/components/events';
import type { SanityEvent } from '@/types';

export interface SocietyEventsProps {
  societyName: string;
  events: SanityEvent[];
}

export function SocietyEvents({ societyName, events }: SocietyEventsProps) {
  return (
    <section>
      <span className="eyebrow">Upcoming events</span>
      {events.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {events.map((event) => (
            <li key={event._id}>
              <EventCard event={event} />
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
          <Link href="/events" className="inline-link inline-flex min-h-6 items-center font-sans text-[14px] font-medium text-ink">
            View the SAOC events calendar →
          </Link>
        </div>
      )}
    </section>
  );
}
