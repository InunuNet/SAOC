import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/admin-auth';
import { studioPdfInput, studioSampleOrder } from '@/lib/ticket-design/studio-samples';
import { readStudioDesign } from '@/lib/ticket-design/studio-request';
import { buildTicketPdf } from '@/lib/ticket-pdf';

/**
 * POST /api/admin/studio/preview-pdf -- draft design in, the ticket PDF out, through the real
 * buildTicketPdf. Admin session plus TICKET_STUDIO_ENABLED=1, else 404.
 */
export const dynamic = 'force-dynamic';

const HEADERS = { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'private, no-store' };
const NOT_FOUND = () => NextResponse.json({ error: 'Not found' }, { status: 404, headers: HEADERS });

export async function POST(request: Request) {
  if (process.env.TICKET_STUDIO_ENABLED !== '1') return NOT_FOUND();
  const session = await getAdminSession();
  if (!session.ok) return NOT_FOUND();

  let design;
  try {
    design = await readStudioDesign(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid design';
    return NextResponse.json({ error: message }, { status: 400, headers: HEADERS });
  }

  const pdf = await buildTicketPdf(studioPdfInput(studioSampleOrder(design.slug)), design);
  return new Response(Buffer.from(pdf), {
    headers: { ...HEADERS, 'Content-Type': 'application/pdf' },
  });
}
