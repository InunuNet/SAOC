import { NextRequest, NextResponse } from 'next/server';

import { ozowProvider } from '@/lib/payments/ozow';
import { POST as handleNotification } from '@/lib/tickets-notification';

/**
 * Ozow's notification route (F2, ozow-payment-provider M2) — a NEW, dedicated route, never
 * PayFast's path. Calls the same shared eleven-step handler PayFast's route calls, naming
 * exactly one provider, never PayFast's. See contracts/golden/ozow-m1-f2/README.md §4 for why
 * this is a second thin route rather than PayFast's route branching on a query param.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleNotification(ozowProvider, request);
}
