import { NextResponse } from 'next/server';

import { buildVCalendar, type IcsEventInput } from '@/lib/ics';
import { sanityFetch } from '@/sanity/lib/fetch';
import { upcomingEventsQuery } from '@/sanity/queries';
import type { SanityEvent } from '@/types';

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

  const inputs: IcsEventInput[] = (raw ?? []).map(toInput);

  const body = buildVCalendar(inputs);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="saoc-events.ics"',
    },
  });
}
