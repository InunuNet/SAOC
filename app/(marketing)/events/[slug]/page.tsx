import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

import { ShowBand } from '@/components/home';
import { JsonLd, eventJsonLd } from '@/components/seo/JsonLd';
import { buildEventMetadata } from '@/lib/event-metadata';
import { isNationalShowEvent } from '@/lib/events-list';
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
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

  return (
    <div className="mx-auto max-w-[860px] px-8 py-16">
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

      {/* Back link */}
      <Link
        href="/events"
        className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted hover:text-ink"
      >
        ← All events
      </Link>

      {/* Kind badge */}
      {event.kind ? (
        <p
          data-event-kind
          className="mt-3.5 block w-fit rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ backgroundColor: 'var(--bone)', color: 'var(--muted)' }}
        >
          {event.kind}
        </p>
      ) : null}

      {/* Title */}
      <h1 className="mt-4 font-serif tracking-[-0.015em] font-light text-[36px] leading-tight text-ink">
        {event.title}
      </h1>

      {/* Dates */}
      <p className="mt-3 font-sans text-[15px] text-ink/70">
        {formatDate(event.date)}
        {event.endDate && event.endDate !== event.date
          ? ` – ${formatDate(event.endDate)}`
          : null}
      </p>

      {/* Metadata */}
      <dl className="mt-6 space-y-2 border-y border-rule py-6 font-sans text-[14px]">
        {event.hostSociety ? (
          <div className="flex gap-3">
            <dt className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Hosted by
            </dt>
            <dd className="text-ink/80">
              <Link
                href={`/societies/${event.hostSociety.slug}`}
                className="hover:text-ink hover:underline"
              >
                {event.hostSociety.name}
              </Link>
            </dd>
          </div>
        ) : null}

        {event.venue ? (
          <div className="flex gap-3">
            <dt className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Venue
            </dt>
            <dd className="text-ink/80">{event.venue}</dd>
          </div>
        ) : null}

        {event.location ? (
          <div className="flex gap-3">
            <dt className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Location
            </dt>
            <dd className="text-ink/80">{event.location}</dd>
          </div>
        ) : null}
      </dl>

      {/* National Show events carry the show band (SV-1) */}
      {show ? (
        <div className="mt-8">
          <ShowBand show={show} />
        </div>
      ) : null}

      {/* Description */}
      {event.description ? (
        <p className="mt-8 font-sans text-[16px] leading-relaxed text-ink/80">
          {event.description}
        </p>
      ) : null}
    </div>
  );
}
