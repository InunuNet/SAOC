import { NextResponse } from 'next/server';

import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { consumeRateLimit } from '@/lib/newsletter-rate-limit';
import { createAttemptStore, scopeAttemptsToRequest } from '@/lib/newsletter-rate-store';
import { getConfirmedOrderForDisplay } from '@/lib/orders';
import { buildTicketPdf } from '@/lib/ticket-pdf';
import { authoriseTicketPdfRequest, refPrefix } from '@/lib/ticket-pdf-access';
import { loadTicketPdfVisit, loadTicketTypeTraits, toPdfPositions } from '@/lib/ticket-pdf-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };
const NOT_FOUND_BODY = 'Not found';

// Each valid request runs a CPU-bound PDF render, so the cap is tight.
const PDF_RATE_LIMIT_MAX_ATTEMPTS = 10;
const PDF_RATE_LIMIT_WINDOW_MS = 60_000;

const attempts = createAttemptStore(PDF_RATE_LIMIT_WINDOW_MS);

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
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  const limit = consumeRateLimit(
    { now: new Date(), ...scopeAttemptsToRequest(attempts) },
    `ticket-pdf:${ip ?? 'unknown'}`,
    PDF_RATE_LIMIT_MAX_ATTEMPTS,
    PDF_RATE_LIMIT_WINDOW_MS,
  );
  if (!limit.allowed) {
    return new NextResponse('Too many attempts. Please try again later.', {
      status: 429,
      headers: { ...PRIVATE_HEADERS, 'Retry-After': String(limit.retryAfterSeconds) },
    });
  }

  const url = new URL(request.url);
  const ref = url.searchParams.get('ref');
  const position = url.searchParams.get('position');

  const access = await authoriseTicketPdfRequest(
    { ref, position },
    { getConfirmedOrder: getConfirmedOrderForDisplay }
  );
  if (!access.ok) return notFound();

  try {
    const [visit, traits] = await Promise.all([loadTicketPdfVisit(), loadTicketTypeTraits()]);
    const bytes = await buildTicketPdf({
      orderReference: access.orderReference,
      positions: toPdfPositions(
        access.positions,
        new Map(access.positions.map((p) => [p.bookingRef, p.chosenDay ?? null])),
        visit,
        traits
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
