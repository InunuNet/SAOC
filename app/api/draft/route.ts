import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { constantTimeStringEqual } from '@/lib/recovery-token';
import { safeNextPath } from '@/lib/safe-next-path';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const expected = process.env.SANITY_REVALIDATE_SECRET;

  if (!expected || secret === null || !constantTimeStringEqual(secret, expected)) {
    return new Response('Invalid secret', { status: 401 });
  }

  const draft = await draftMode();
  draft.enable();

  redirect(safeNextPath(request.nextUrl.searchParams.get('slug'), '/'));
}
