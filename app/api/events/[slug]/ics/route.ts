import { notFound } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';

import { buildVCalendar, type IcsEventInput } from '@/lib/ics';
import { sanityFetch } from '@/sanity/lib/fetch';
import { eventBySlugQuery } from '@/sanity/queries';
import type { SanityEvent } from '@/types';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getFallbackInput(slug: string): Promise<IcsEventInput | null> {
  const { events: staticEvents } = await import('@/lib/data/events');
  const match = staticEvents.find((e) => slugify(e.title) === slug);
  if (!match) return null;
  return {
    slug,
    title: match.title,
    start: match.date,
    end: match.endDate ?? null,
    description: match.description ?? null,
    venue: match.venue ?? null,
    location: null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;

  const event = await sanityFetch<SanityEvent | null>({
    query: eventBySlugQuery,
    params: { slug },
    tags: ['events', 'sanity'],
  });

  const input: IcsEventInput | null = event
    ? {
        slug: event.slug,
        title: event.title,
        start: event.date,
        end: event.endDate ?? null,
        description: event.description ?? null,
        venue: event.venue ?? null,
        location: event.location ?? null,
      }
    : await getFallbackInput(slug);

  if (!input) {
    notFound();
  }

  const body = buildVCalendar([input]);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
    },
  });
}
