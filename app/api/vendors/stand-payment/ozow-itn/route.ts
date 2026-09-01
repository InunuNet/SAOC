import { NextRequest, NextResponse } from 'next/server';

import { ozowProvider } from '@/lib/payments/ozow';
import { POST as handleNotification } from '@/lib/vendor-stand-payment-notification';

/**
 * Ozow's stand-payment notification route (mission vendor-gated-registration-flow, M3/F31) --
 * a NEW, dedicated route, never PayFast's path. Calls the same shared handler PayFast's route
 * calls, naming exactly one provider, never PayFast's. See
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "Settlement".
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleNotification(ozowProvider, request);
}
