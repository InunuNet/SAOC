import { EventCard, type ListedEvent } from './EventCard';

export interface MonthGroupProps {
  month: string;
  events: ListedEvent[];
}

export function MonthGroup({ month, events }: MonthGroupProps) {
  return (
    <section>
      <h2 className="mb-2 font-serif text-[24px] font-normal leading-snug text-primary">{month}</h2>
      <ul className="border-t border-rule">
        {events.map((event) => (
          <li key={event._id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  );
}
