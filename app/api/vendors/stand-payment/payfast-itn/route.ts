import { NextRequest, NextResponse } from 'next/server';

import { payfastProvider } from '@/lib/payments/payfast';
import { POST as handleNotification } from '@/lib/vendor-stand-payment-notification';

/**
 * PayFast's stand-payment notification route (mission vendor-gated-registration-flow, M3/F31)
 * -- a thin pass-through that names exactly one provider, never Ozow's. Same shape as
 * app/api/tickets/itn/route.ts vs .../ozow-itn/route.ts. See
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "Settlement".
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleNotification(payfastProvider, request);
}
