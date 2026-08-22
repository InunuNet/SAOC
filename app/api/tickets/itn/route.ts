import { NextRequest, NextResponse } from 'next/server';

import { payfastProvider } from '@/lib/payments/payfast';
import { POST as handleNotification } from '@/lib/tickets-notification';

/**
 * PayFast's notification route — EXACT PATH UNCHANGED (its NotifyUrl is already registered
 * against the live sandbox account). F2 (ozow-payment-provider, M2) extracted this route's own
 * eleven-step body into lib/tickets-notification.ts's shared handler; this file is now a thin
 * pass-through that names exactly one provider, never Ozow's. See
 * contracts/golden/ozow-m1-f2/README.md §4.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleNotification(payfastProvider, request);
}
