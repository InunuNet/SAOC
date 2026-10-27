import type { Metadata } from 'next';

import { RouteHero } from '@/components/ui/RouteHero';
import { EventsAbout, EventsList, eventHref, type ListedEvent } from '@/components/events';
import { ShowBand } from '@/components/home';
import { JsonLd, eventJsonLd } from '@/components/seo/JsonLd';
import { isNationalShowEvent, listSectionVisible, splitListed } from '@/lib/events-list';
import { upcomingEventsParams } from '@/lib/sast-date';
import { PLACEHOLDER_EVENTS_NOTE, upcomingPlaceholderEvents } from '@/lib/data/placeholder-events';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { saocUrl } from '@/lib/site-hosts';
import { sanityFetch } from '@/sanity/lib/fetch';
import { eventsPageQuery, nationalShowQuery, upcomingEventsQuery } from '@/sanity/queries';
import type { SanityEvent, ShowIdentity } from '@/types';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

const LEDE =
  "Shows, workshops, and council meetings across South Africa's affiliated orchid societies.";

export const metadata: Metadata = buildPageMetadata({
  title: 'Events',
  description: LEDE,
  lede: LEDE,
  path: '/events',
});

/** Absolute URL of an event's page: SAOC's own, or the NOS home for the National Show. */
function eventUrl(event: Parameters<typeof eventHref>[0]): string {
  const href = eventHref(event);
  return href.startsWith('/') ? saocUrl(href) : href;
}

export default async function EventsPage() {
  const [raw, show, eventsPage] = await Promise.all([
    sanityFetch<SanityEvent[]>({
      query: upcomingEventsQuery,
      params: upcomingEventsParams(),
      tags: ['events', 'sanity'],
    }),
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    sanityFetch<{ intro?: Parameters<typeof EventsAbout>[0]['intro'] }>({
      query: eventsPageQuery,
      tags: ['eventsPage', 'sanity'],
    }),
  ]);

  const events: SanityEvent[] = raw ?? [];
  const withhold = withholdPlaceholderProse();

  // The preview gate is evaluated at static/ISR render. On App Hosting any env or secret change creates a new
  // build and rollout, so a preview-built cache cannot outlive a SITE_PUBLIC_LAUNCH flip.
  // Brad: keep the invented events in, noted as awaiting SAOC's official calendar. Preview only: a public
  // build lists none. They join the rows below but never `events`, which feeds the JSON-LD Event nodes.
  const placeholders = withhold ? [] : upcomingPlaceholderEvents(new Date(), events);
  const listed: ListedEvent[] = [...events, ...placeholders].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // The National Show leads the page in the band, so it is not listed a second time.
  const { rest } = splitListed(listed);
  const showEvent = events.find((event) => isNationalShowEvent(event) && event.slug);

  return (
    <>
      <RouteHero
        exempt
        route="/events"
        eyebrow="SAOC calendar"
        heading="Events"
        lede={LEDE}
      />

      {/* One Event node per real event, so search engines read what the page lists. */}
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
            url: eventUrl(event),
          })}
        />
      ))}

      <ShowBand
        show={show}
        detailsHref={showEvent ? `/events/${showEvent.slug}` : undefined}
        showPhoto={false}
      />

      <EventsAbout
        intro={eventsPage?.intro}
        placeholderNote={placeholders.length > 0 ? PLACEHOLDER_EVENTS_NOTE : null}
      />

      {listSectionVisible(rest.length) ? (
        <section data-events-list className="saoc-container pb-20">
          <EventsList events={rest} />
        </section>
      ) : null}
    </>
  );
}
