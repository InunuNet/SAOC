import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/admin-auth';
import { contrastFailures } from '@/lib/ticket-design/contrast';
import { formatSettings } from '@/lib/ticket-design/format';
import { validateDesign } from '@/lib/ticket-design';
import { isStudioPilotSlug } from '@/lib/ticket-design/studio-samples';

/**
 * POST /api/admin/studio/save -- validates the design, then writes
 * lib/ticket-design/settings/<slug>.json for a person to review and commit. Admin session plus
 * TICKET_STUDIO_ENABLED=1, else 404. Refuses in production: only the dev server can write files.
 */
export const dynamic = 'force-dynamic';

const HEADERS = { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'private, no-store' };
const NOT_FOUND = () => NextResponse.json({ error: 'Not found' }, { status: 404, headers: HEADERS });
const SETTINGS_DIR = path.join('lib', 'ticket-design', 'settings');

function reject(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: HEADERS });
}

export async function POST(request: Request) {
  if (process.env.TICKET_STUDIO_ENABLED !== '1') return NOT_FOUND();
  const session = await getAdminSession();
  if (!session.ok) return NOT_FOUND();
  if (process.env.NODE_ENV === 'production') return reject('Saving is only available on dev', 403);

  let design;
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('design' in body)) {
      return reject('body must be { design }', 400);
    }
    design = validateDesign(body.design);
  } catch (error) {
    return reject(error instanceof Error ? error.message : 'invalid design', 400);
  }
  if (!isStudioPilotSlug(design.slug)) {
    return reject(`ticket type "${design.slug}" is not in the studio pilot`, 400);
  }
  const failing = contrastFailures(design);
  if (failing.length > 0) {
    return reject(`contrast under 4.5:1: ${failing.map((f) => f.label).join(', ')}`, 400);
  }

  // The slug passed the pilot allowlist above, so the path cannot leave the settings folder.
  const file = path.join(process.cwd(), SETTINGS_DIR, `${design.slug}.json`);
  await writeFile(file, formatSettings(design), 'utf8');
  return NextResponse.json({ saved: `${SETTINGS_DIR}/${design.slug}.json` }, { headers: HEADERS });
}
