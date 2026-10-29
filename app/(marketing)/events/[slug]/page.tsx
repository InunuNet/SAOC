import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { ShowBand } from '@/components/home';
import { JsonLd, eventJsonLd } from '@/components/seo/JsonLd';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { VenueCard } from '@/components/show';
import { SAOC_LINK_RING } from '@/components/ui/saoc-link-ring';
import { RouteHero } from '@/components/ui/RouteHero';
import { buildEventMetadata } from '@/lib/event-metadata';
import { isNationalShowEvent } from '@/lib/events-list';
import type { HeroFact } from '@/lib/hero-facts';
import { formatShowDateRange } from '@/lib/show-identity';
import { saocUrl } from '@/lib/site-hosts';
import { sanityFetch } from '@/sanity/lib/fetch';
import { eventBySlugQuery, eventSlugsQuery, nationalShowQuery } from '@/sanity/queries';
import type { SanityEvent, ShowIdentity, ShowVenue } from '@/types';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

interface SlugResult {
  slug: string;
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const results = await sanityFetch<SlugResult[]>({
    query: eventSlugsQuery,
    tags: ['societyEvent', 'sanity'],
  });
  return (results ?? []).map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await sanityFetch<SanityEvent>({
    query: eventBySlugQuery,
    params: { slug },
    tags: ['societyEvent', 'sanity'],
  });
  if (!event) notFound();
  return buildEventMetadata(event, slug);
}

// Hero facts come straight from the event record. The National Show reads the host region from the
// nationalShow singleton (the field ShowBand's "Host Region" reads); any other event names its host
// society. An absent field drops out of the row (lib/hero-facts.ts); nothing stands in for it.
function eventFacts(event: SanityEvent, show: ShowIdentity | null): HeroFact[] {
  return [
    { term: 'Dates', value: formatShowDateRange(event.date, event.endDate) ?? '' },
    { term: 'Venue', value: event.venue ?? '' },
    show
      ? { term: 'Host region', value: show.hostRegion ?? '' }
      : { term: 'Hosted by', value: event.hostSociety?.name ?? '' },
  ];
}

/** A venue block only earns its place when the record says more than the name (the hero already has it). */
function hasVenueDetail(venue: ShowVenue | null | undefined): venue is ShowVenue {
  return Boolean(venue?.name && (venue.addressLines?.length || venue.city || venue.mapsUrl));
}

/**
 * The page's one contextual block. A National Show reads the show's venue through the same
 * VenueCard /contact uses (name, address, "Open in a map"); any other event has only its own venue
 * and location strings, so it shows a block only when the location adds to the name.
 */
function venueBlock(event: SanityEvent, show: ShowIdentity | null): ReactNode | null {
  if (show) return hasVenueDetail(show.venue) ? <VenueCard venue={show.venue} linkClassName={SAOC_LINK_RING} /> : null;
  if (!event.venue || !event.location) return null;
  return (
    <section>
      <h3 className="doc-aside-heading">The venue</h3>
      <address className="not-italic font-sans text-[16px] leading-[1.55] text-ink/80">
        <span className="block font-serif font-medium text-[18px] text-ink">{event.venue}</span>
        <span className="block">{event.location}</span>
      </address>
    </section>
  );
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await sanityFetch<SanityEvent>({
    query: eventBySlugQuery,
    params: { slug },
    tags: ['societyEvent', 'sanity'],
  });

  if (!event) {
    notFound();
  }

  const show = isNationalShowEvent(event)
    ? await sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] })
    : null;
  const venue = venueBlock(event, show);

  // Never an empty column. With a description it fills the prose column and the venue block is the
  // aside. Without one, the National Show's band follows the hero directly (it carries the venue),
  // and any other event's venue block takes the content column.
  const layout = event.description ? (
    <DocumentLayout aside={venue ?? undefined}>
      <div className="doc-prose">
        <p>{event.description}</p>
      </div>
    </DocumentLayout>
  ) : venue && !show ? (
    <DocumentLayout>{venue}</DocumentLayout>
  ) : null;

  return (
    <>
      <JsonLd
        data={eventJsonLd({
          name: event.title,
          startDate: event.date,
          endDate: event.endDate,
          location: event.location,
          venue: event.venue,
          description: event.description,
          organizer: event.hostSociety?.name,
          url: saocUrl(`/events/${event.slug}`),
        })}
      />

      <Breadcrumb items={[{ label: 'Events', href: '/events' }, { label: event.title }]} />
      <RouteHero
        route="/events/[slug]"
        eyebrow={event.kind ?? undefined}
        heading={event.title}
        facts={eventFacts(event, show)}
        factsAlign="start"
      >
        {/* National Show events carry the show band (SV-1): straight after the hero when there is no
            document layout, otherwise after the layout */}
        {show && !layout ? <ShowBand show={show} split="event" /> : null}
      </RouteHero>

      {layout}

      {show && layout ? <ShowBand show={show} split="event" /> : null}
    </>
  );
}
