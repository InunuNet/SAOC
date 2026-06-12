import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { EventCard, MonthGroup } from '@/components/events';
import { sanityFetch } from '@/sanity/lib/fetch';
import { upcomingEventsQuery } from '@/sanity/queries';
import type { SanityEvent } from '@/types';

export const metadata: Metadata = { title: 'Events' };

/** Month label from an ISO date string, e.g. "June 2026" */
function monthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Group a sorted list of events by calendar month.
 * Returns an ordered array of [monthLabel, events] pairs.
 */
function groupByMonth(events: SanityEvent[]): Array<{ month: string; events: SanityEvent[] }> {
  const map = new Map<string, SanityEvent[]>();

  for (const event of events) {
    const label = monthLabel(event.date);
    const bucket = map.get(label);
    if (bucket) {
      bucket.push(event);
    } else {
      map.set(label, [event]);
    }
  }

  return Array.from(map.entries()).map(([month, evts]) => ({ month, events: evts }));
}

/** Convert the static SocietyEvent fallback shape to SanityEvent. */
async function getFallbackEvents(): Promise<SanityEvent[]> {
  const { events: staticEvents } = await import('@/lib/data/events');
  return staticEvents.map((e) => ({
    _id: String(e.id),
    title: e.title,
    slug: e.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    date: e.date,
    endDate: e.endDate ?? null,
    kind: e.kind ?? null,
    description: e.description ?? null,
    venue: e.venue ?? null,
    location: null,
    isFeatured: null,
    hostSociety: null,
  }));
}

export default async function EventsPage() {
  const raw = await sanityFetch<SanityEvent[]>({
    query: upcomingEventsQuery,
    tags: ['events', 'sanity'],
  });

  const events: SanityEvent[] = raw && raw.length > 0 ? raw : await getFallbackEvents();

  const featured = events.filter((e) => e.isFeatured === true);
  const remaining = events.filter((e) => e.isFeatured !== true);
  const monthGroups = groupByMonth(remaining);

  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="SAOC calendar"
        heading="Events"
        lede="Shows, workshops, and council meetings across South Africa's affiliated orchid societies."
      />

      <div className="mx-auto max-w-[1280px] px-8 py-16 space-y-16">
        {/* Featured events */}
        {featured.length > 0 ? (
          <section>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
              Featured events
            </p>
            <ul className="space-y-3">
              {featured.map((event) => (
                <li key={event._id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Monthly groups */}
        {monthGroups.length > 0 ? (
          <div className="space-y-12">
            {monthGroups.map(({ month, events: monthEvents }) => (
              <MonthGroup key={month} month={month} events={monthEvents} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="font-sans text-[16px] text-ink/60">No upcoming events scheduled.</p>
        ) : null}
      </div>
    </>
  );
}
