import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { EventCard, MonthGroup, eventHref } from '@/components/events';
import { JsonLd, eventJsonLd } from '@/components/seo/JsonLd';
import { ConfirmationBadge } from '@/components/show';
import { sanityFetch } from '@/sanity/lib/fetch';
import { upcomingEventsQuery } from '@/sanity/queries';
import type { SanityEvent } from '@/types';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export const metadata: Metadata = { title: 'Events' };

const BASE_URL = 'https://saoc.co.za';

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

export default async function EventsPage() {
  const raw = await sanityFetch<SanityEvent[]>({
    query: upcomingEventsQuery,
    tags: ['events', 'sanity'],
  });

  const events: SanityEvent[] = raw ?? [];

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

      <div className="saoc-container py-16 space-y-16">
        {/* One Event node per listed row, so search engines read what the page lists. */}
        {events.map((event) => (
          <JsonLd
            key={event._id}
            data={eventJsonLd({
              name: event.title,
              startDate: event.date,
              endDate: event.endDate,
              location: event.location,
              venue: event.venue,
              description: event.description,
              organizer: event.hostSociety?.name,
              url: `${BASE_URL}${eventHref(event)}`,
            })}
          />
        ))}

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
          <div className="space-y-3">
            <p className="font-sans text-[16px] text-ink/70">No upcoming events scheduled.</p>
            <ConfirmationBadge status="pending" />
          </div>
        ) : null}
      </div>
    </>
  );
}
