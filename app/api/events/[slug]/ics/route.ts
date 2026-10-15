import { notFound } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';

import { buildVCalendar, type IcsEventInput } from '@/lib/ics';
import { sanityFetch } from '@/sanity/lib/fetch';
import { eventBySlugQuery } from '@/sanity/queries';
import type { SanityEvent } from '@/types';

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
    : null;

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
