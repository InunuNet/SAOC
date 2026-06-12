import type { SanityEvent } from '@/types';

import { EventCard } from './EventCard';

export interface MonthGroupProps {
  month: string;
  events: SanityEvent[];
}

export function MonthGroup({ month, events }: MonthGroupProps) {
  return (
    <section>
      <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">{month}</h2>
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event._id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  );
}
