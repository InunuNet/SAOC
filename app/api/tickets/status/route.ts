import { NextRequest, NextResponse } from 'next/server';

import {
  AbuseLimiterUnavailableError,
  clientActorKey,
  consumeAbuseLimit,
  type AbuseLimitDecision,
} from '@/lib/abuse-limiter';
import { getTicketStatus } from '@/lib/ticket-status';

// ConfirmationPoller makes up to 20 requests a minute per buyer; 120 covers six buyers on one
// venue address.
const STATUS_RATE_LIMIT_MAX_ATTEMPTS = 120;
const STATUS_RATE_LIMIT_WINDOW_MS = 60_000;

// F3 (ticketing-pages) — read-only status endpoint so /tickets/confirmation can poll
// without claiming success or failure prematurely (the PayFast ITN race). Returns the
// absolute minimum: { status }. No name, email, price paid, or internal ids (see
// contracts/golden/ticketing-m1-m2/status-endpoint-response.golden.json).
// Unauthenticated by necessity — the buyer has no account, only the ref in their return
// URL. Booking refs are 60 bits (lib/booking-ref.ts), so this is not enumerable; but
// anyone holding a ref — a photo of a ticket — can see its check-in state, so "status
// only" stays the load-bearing mitigation and must not be widened. Per-IP rate
// limiting is durable and shared across instances (lib/abuse-limiter.ts).
export async function GET(request: NextRequest): Promise<NextResponse> {
  let limit: AbuseLimitDecision;
  try {
    limit = await consumeAbuseLimit({
      scope: 'ticket-status',
      key: clientActorKey(request.headers.get('x-forwarded-for')),
      maxAttempts: STATUS_RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: STATUS_RATE_LIMIT_WINDOW_MS,
    });
  } catch (error) {
    if (!(error instanceof AbuseLimiterUnavailableError)) throw error;
    console.error('[tickets/status] Abuse limiter unavailable:', error.name);
    return NextResponse.json({ error: 'Unable to check status. Please try again.' }, {
      status: 500,
    });
  }
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const ref = request.nextUrl.searchParams.get('ref');
  if (!ref || ref.trim().length === 0) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    const status = await getTicketStatus(ref);
    if (!status) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error('[tickets/status] Failed to look up ticket status:', error);
    return NextResponse.json({ error: 'Unable to check status. Please try again.' }, {
      status: 500,
    });
  }
}
