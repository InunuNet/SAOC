import { render } from '@react-email/components';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/admin-auth';
import { studioEmailInput, studioPreviewHtml, studioSampleOrder } from '@/lib/ticket-design/studio-samples';
import { readStudioDesign } from '@/lib/ticket-design/studio-request';
import { buildTicketTypeEmail } from '@/lib/ticket-type-email';

/**
 * POST /api/admin/studio/preview-email -- draft design in, rendered confirmation email HTML out,
 * through the real buildTicketTypeEmail. Admin session plus TICKET_STUDIO_ENABLED=1, else 404.
 * Nothing is sent.
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

  const order = studioSampleOrder(design.slug);
  const email = buildTicketTypeEmail({ ...studioEmailInput(order), design });
  const html = await studioPreviewHtml(await render(email.react), order);
  return NextResponse.json({ subject: email.subject, html }, { headers: HEADERS });
}
