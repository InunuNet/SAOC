import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

import { sanityFetch } from '@/sanity/lib/fetch';
import { eventBySlugQuery, eventSlugsQuery } from '@/sanity/queries';
import type { SanityEvent } from '@/types';

interface SlugResult {
  slug: string;
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const results = await sanityFetch<SlugResult[]>({
    query: eventSlugsQuery,
    tags: ['events'],
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
    tags: ['events'],
  });
  return { title: event?.title ?? 'Event' };
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
    tags: ['events'],
  });

  if (!event) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-[860px] px-8 py-16">
      {/* Back link */}
      <Link
        href="/events"
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted hover:text-ink"
      >
        ← All events
      </Link>

      {/* Kind badge */}
      {event.kind ? (
        <p
          className="mt-6 inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ backgroundColor: 'var(--bone)', color: 'var(--accent)' }}
        >
          {event.kind}
        </p>
      ) : null}

      {/* Title */}
      <h1 className="mt-3 font-serif text-[36px] font-semibold leading-tight text-ink">
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

      {/* Description */}
      {event.description ? (
        <p className="mt-8 font-sans text-[16px] leading-relaxed text-ink/80">
          {event.description}
        </p>
      ) : null}
    </div>
  );
}
