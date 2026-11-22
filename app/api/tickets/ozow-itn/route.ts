import { NextRequest, NextResponse } from 'next/server';

import { ozowProvider } from '@/lib/payments/ozow';
import { readBodyTextWithinLimit } from '@/lib/request-guards';
import { POST as handleNotification } from '@/lib/tickets-notification';

/** A real Ozow notification is a ~20 field form (well under 2 KB); this leaves wide headroom. */
const MAX_NOTIFICATION_BODY_BYTES = 16 * 1024;

/**
 * Ozow's notification route (F2, ozow-payment-provider M2) — a NEW, dedicated route, never
 * PayFast's path. Calls the same shared eleven-step handler PayFast's route calls, naming
 * exactly one provider, never PayFast's. See contracts/golden/ozow-m1-f2/README.md §4 for why
 * this is a second thin route rather than PayFast's route branching on a query param.
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
  return handleNotification(ozowProvider, bounded);
}
