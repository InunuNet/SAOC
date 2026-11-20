import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/admin-auth';
import { isStudioSlug } from '@/lib/ticket-design/studio-samples';
import { exportSamplesForKey } from '@/scripts/generate-ticket-email-samples';

/**
 * POST /api/admin/studio/export -- writes the email PDF and ticket PDF for one ticket type into
 * samples/ticket-emails, using the saved settings. Admin session plus TICKET_STUDIO_ENABLED=1,
 * else 404. Refuses in production. Nothing is sent.
 */
export const dynamic = 'force-dynamic';

const HEADERS = { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'private, no-store' };
const NOT_FOUND = () => NextResponse.json({ error: 'Not found' }, { status: 404, headers: HEADERS });
const OUT_DIR = 'samples/ticket-emails';

function reject(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: HEADERS });
}

export async function POST(request: Request) {
  if (process.env.TICKET_STUDIO_ENABLED !== '1') return NOT_FOUND();
  const session = await getAdminSession();
  if (!session.ok) return NOT_FOUND();
  if (process.env.NODE_ENV === 'production') return reject('Export is only available on dev', 403);

  let slug: unknown;
  try {
    const body: unknown = await request.json();
    slug = typeof body === 'object' && body !== null && 'slug' in body ? body.slug : undefined;
  } catch {
    return reject('body must be { slug }', 400);
  }
  // The ticket-type allowlist keeps the slug out of the file name until it is known to be safe.
  if (typeof slug !== 'string' || !isStudioSlug(slug)) {
    return reject('ticket type is not a known studio ticket type', 400);
  }

  try {
    const written = await exportSamplesForKey(slug, OUT_DIR);
    return NextResponse.json({ written }, { headers: HEADERS });
  } catch (error) {
    return reject(error instanceof Error ? error.message : 'export failed', 500);
  }
}
