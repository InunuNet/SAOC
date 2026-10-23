import { NextResponse } from 'next/server';

import { matchSocieties } from '@/lib/societies/search';
import type { SocietySearchHit } from '@/lib/societies/search';
import { sanityFetch } from '@/sanity/lib/fetch';
import { societyListQuery } from '@/sanity/queries';

const MAX_TERM_LENGTH = 80;

// Global-search source for societies: the same listed-only query as /societies, so a hidden
// society (`listed: false`) can never be found.
export async function GET(request: Request): Promise<NextResponse> {
  const term = new URL(request.url).searchParams.get('q') ?? '';
  if (term.length > MAX_TERM_LENGTH) return NextResponse.json([]);
  const societies = await sanityFetch<SocietySearchHit[]>({
    query: societyListQuery,
    tags: ['society', 'sanity'],
  });
  return NextResponse.json(matchSocieties(societies ?? [], term));
}
