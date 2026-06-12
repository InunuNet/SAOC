import { NextResponse } from 'next/server';

import { buildVCalendar, type IcsEventInput } from '@/lib/ics';
import { sanityFetch } from '@/sanity/lib/fetch';
import { upcomingEventsQuery } from '@/sanity/queries';
import type { SanityEvent } from '@/types';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getFallbackInputs(): Promise<IcsEventInput[]> {
  const { events: staticEvents } = await import('@/lib/data/events');
  return staticEvents.map((e) => ({
    slug: slugify(e.title),
    title: e.title,
    start: e.date,
    end: e.endDate ?? null,
    description: e.description ?? null,
    venue: e.venue ?? null,
    location: null,
  }));
}

function toInput(event: SanityEvent): IcsEventInput {
  return {
    slug: event.slug,
    title: event.title,
    start: event.date,
    end: event.endDate ?? null,
    description: event.description ?? null,
    venue: event.venue ?? null,
    location: event.location ?? null,
  };
}

export async function GET(): Promise<NextResponse> {
  const raw = await sanityFetch<SanityEvent[]>({
    query: upcomingEventsQuery,
    tags: ['events', 'sanity'],
  });

  const inputs: IcsEventInput[] =
    raw && raw.length > 0 ? raw.map(toInput) : await getFallbackInputs();

  const body = buildVCalendar(inputs);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="saoc-events.ics"',
    },
  });
}
