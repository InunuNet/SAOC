// Metadata for /events/[slug]. Pure: no Sanity or firebase-admin imports. Canonical and og:url go
// through buildPageMetadata, so they follow the configured site origin rather than a literal.

import type { Metadata } from 'next';

import { buildPageMetadata } from '@/lib/seo';

export interface EventMetadataInput {
  title: string;
  date: string;
  endDate?: string | null;
  description?: string | null;
  venue?: string | null;
  location?: string | null;
}

// Same format the event page renders its dates in.
function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Description for an event with none of its own, built only from its title, dates and venue.
function fallbackDescription(event: EventMetadataInput): string {
  const start = formatEventDate(event.date);
  const end = event.endDate ? formatEventDate(event.endDate) : null;
  const when = end && end !== start ? `${start} – ${end}` : start;
  const where = [event.venue, event.location].filter(Boolean).join(', ');
  return [event.title, when, where].filter(Boolean).join('. ') + '.';
}

export function buildEventMetadata(event: EventMetadataInput, slug: string): Metadata {
  const own = event.description?.trim();
  return buildPageMetadata({
    title: event.title,
    description: own ? own : fallbackDescription(event),
    path: `/events/${slug}`,
  });
}
