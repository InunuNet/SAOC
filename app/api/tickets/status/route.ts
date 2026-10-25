import { NextRequest, NextResponse } from 'next/server';

import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { consumeRateLimit } from '@/lib/newsletter-rate-limit';
import { createAttemptStore, scopeAttemptsToRequest } from '@/lib/newsletter-rate-store';
import { getTicketStatus } from '@/lib/ticket-status';

// ConfirmationPoller polls every 3s for ~1 minute (20 requests); the cap (under the attempt
// store's 50-per-key history) leaves room for several buyers behind one venue address.
const STATUS_RATE_LIMIT_MAX_ATTEMPTS = 40;
const STATUS_RATE_LIMIT_WINDOW_MS = 60_000;

const attempts = createAttemptStore(STATUS_RATE_LIMIT_WINDOW_MS);

// F3 (ticketing-pages) — read-only status endpoint so /tickets/confirmation can poll
// without claiming success or failure prematurely (the PayFast ITN race). Returns the
// absolute minimum: { status }. No name, email, price paid, or internal ids (see
// contracts/golden/ticketing-m1-m2/status-endpoint-response.golden.json).
// Unauthenticated by necessity — the buyer has no account, only the ref in their return
// URL. Booking refs are 60 bits (lib/booking-ref.ts), so this is not enumerable; but
// anyone holding a ref — a photo of a ticket — can see its check-in state, so "status
// only" stays the load-bearing mitigation and must not be widened. Per-IP rate
// limiting is per server instance (see lib/public-form-rate-limit.ts).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  const limit = consumeRateLimit(
    { now: new Date(), ...scopeAttemptsToRequest(attempts) },
    `ticket-status:${ip ?? 'unknown'}`,
    STATUS_RATE_LIMIT_MAX_ATTEMPTS,
    STATUS_RATE_LIMIT_WINDOW_MS,
  );
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
