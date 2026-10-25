import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { ShowBand } from '@/components/home';
import { JsonLd, eventJsonLd } from '@/components/seo/JsonLd';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { PageHero } from '@/components/ui/PageHero';
import { buildEventMetadata } from '@/lib/event-metadata';
import { isNationalShowEvent } from '@/lib/events-list';
import type { HeroFact } from '@/lib/hero-facts';
import { formatShowDateRange } from '@/lib/show-identity';
import { saocUrl } from '@/lib/site-hosts';
import { sanityFetch } from '@/sanity/lib/fetch';
import { eventBySlugQuery, eventSlugsQuery, nationalShowQuery } from '@/sanity/queries';
import type { SanityEvent, ShowIdentity } from '@/types';

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
  const hasVenueAside = Boolean(event.venue || event.location || event.hostSociety);

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
      <PageHero
        image="/images/orchid-dark.jpg"
        eyebrow={event.kind ?? undefined}
        heading={event.title}
        facts={eventFacts(event, show)}
      />

      <DocumentLayout
        aside={
          hasVenueAside ? (
            <>
              <h2 className="doc-aside-heading">Venue</h2>
              {event.venue ? (
                <p className="font-sans text-[16px] leading-[1.55] text-ink">{event.venue}</p>
              ) : null}
              {event.location ? (
                <p className="font-sans text-[16px] leading-[1.55] text-ink/80">{event.location}</p>
              ) : null}
              {event.hostSociety ? (
                <p className="mt-4 font-sans text-[16px] leading-[1.55] text-ink/80">
                  Hosted by{' '}
                  <Link
                    href={`/societies/${event.hostSociety.slug}`}
                    className="text-ink underline underline-offset-2"
                  >
                    {event.hostSociety.name}
                  </Link>
                </p>
              ) : null}
            </>
          ) : undefined
        }
      >
        {event.description ? (
          <div className="doc-prose">
            <p>{event.description}</p>
          </div>
        ) : null}
      </DocumentLayout>

      {/* National Show events carry the show band (SV-1) */}
      {show ? <ShowBand show={show} /> : null}
    </>
  );
}
