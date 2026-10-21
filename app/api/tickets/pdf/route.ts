import { NextResponse } from 'next/server';

import { getConfirmedOrderForDisplay } from '@/lib/orders';
import { buildTicketPdf } from '@/lib/ticket-pdf';
import { authoriseTicketPdfRequest, refPrefix } from '@/lib/ticket-pdf-access';
import { loadTicketPdfVisit, toPdfPositions } from '@/lib/ticket-pdf-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };
const NOT_FOUND_BODY = 'Not found';

/** The one response for every access failure: same status, body and headers whatever the cause. */
function notFound(): NextResponse {
  return new NextResponse(NOT_FOUND_BODY, {
    status: 404,
    headers: { ...PRIVATE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * GET /api/tickets/pdf?ref=<order reference>[&position=<bookingRef>] — the branded A4 ticket PDF.
 * Access is decided by authoriseTicketPdfRequest (lib/ticket-pdf-access.ts): a paid order's
 * reference is required, and `position` can only select one of that order's own positions.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref');
  const position = url.searchParams.get('position');

  const access = await authoriseTicketPdfRequest(
    { ref, position },
    { getConfirmedOrder: getConfirmedOrderForDisplay }
  );
  if (!access.ok) return notFound();

  try {
    const visit = await loadTicketPdfVisit();
    const bytes = await buildTicketPdf({
      orderReference: access.orderReference,
      positions: toPdfPositions(
        access.positions,
        new Map(access.positions.map((p) => [p.bookingRef, p.chosenDay ?? null])),
        visit
      ),
      visit,
    });
    const stem = access.single ? access.positions[0].bookingRef : access.orderReference;
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="saoc-ticket-${stem.replace(/[^A-Za-z0-9-]/g, '-')}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[tickets/pdf] PDF generation failed', {
      refPrefix: refPrefix(ref),
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return new NextResponse('Ticket PDF unavailable', { status: 500, headers: PRIVATE_HEADERS });
  }
}
