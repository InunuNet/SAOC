import { NextRequest, NextResponse } from 'next/server';

import { payfastProvider } from '@/lib/payments/payfast';
import { readBodyTextWithinLimit } from '@/lib/request-guards';
import { POST as handleNotification } from '@/lib/tickets-notification';

/** A real PayFast notification is a ~30 field form (well under 4 KB); this leaves wide headroom. */
const MAX_NOTIFICATION_BODY_BYTES = 16 * 1024;

/**
 * PayFast's notification route — EXACT PATH UNCHANGED (its NotifyUrl is already registered
 * against the live sandbox account). F2 (ozow-payment-provider, M2) extracted this route's own
 * eleven-step body into lib/tickets-notification.ts's shared handler; this file is now a thin
 * pass-through that names exactly one provider, never Ozow's. See
 * contracts/golden/ozow-m1-f2/README.md §4.
 *
 * An oversize body is refused here, before the shared handler (and its per-rejection logging)
 * runs, with the handler's own acknowledgement shape so the sender stops retrying.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await readBodyTextWithinLimit(request, MAX_NOTIFICATION_BODY_BYTES);
  if (rawBody === null) {
    return NextResponse.json({ received: true }, { status: 200 });
  }
  const bounded = new NextRequest(request.url, {
    method: request.method,
    headers: request.headers,
    body: rawBody,
  });
  return handleNotification(payfastProvider, bounded);
}
