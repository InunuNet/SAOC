import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import {
  ACTIVE_GATEWAY_COLLECTION,
  ACTIVE_GATEWAY_DOC_ID,
  isValidGatewayId,
  resolveActiveGateway,
} from '@/lib/payments/active-gateway';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

/**
 * GET/PUT /api/admin/settings/active-payment-gateway -- admin-only active-gateway setting
 * (mission gateway-picker-admin-only F1). Gated on getAdminSession() first, THEN
 * hasCapability(..., 'manage-payment-settings', ...), same shape as
 * app/api/admin/settings/ozow-sandbox-test-mode/route.ts. See
 * contracts/golden/gateway-picker-admin-only-f1/README.md §6.
 */

async function checkGate(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const session = await getAdminSession();
  if (!session.ok) {
    const status = session.reason === 'no-session' || session.reason === 'invalid-session' ? 401 : 403;
    return {
      ok: false,
      response: NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
    };
  }

  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  if (!hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'manage-payment-settings', { now, lookupShowWindow })) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true };
}

export async function GET(): Promise<NextResponse> {
  const gate = await checkGate();
  if (!gate.ok) return gate.response;

  const gateway = await resolveActiveGateway();
  return NextResponse.json({ gateway });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const gate = await checkGate();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const gateway =
    typeof body === 'object' && body !== null && 'gateway' in body
      ? (body as { gateway: unknown }).gateway
      : undefined;

  if (!isValidGatewayId(gateway)) {
    return NextResponse.json(
      { error: "Request body must be { gateway: 'ozow' | 'payfast' }." },
      { status: 400 },
    );
  }

  try {
    const session = await getAdminSession();
    const email = session.ok ? session.decodedToken.email ?? null : null;
    const db = getFirestore(initAdmin());
    await db
      .collection(ACTIVE_GATEWAY_COLLECTION)
      .doc(ACTIVE_GATEWAY_DOC_ID)
      .set({ gateway, updatedAt: FieldValue.serverTimestamp(), updatedByEmail: email });
    return NextResponse.json({ gateway });
  } catch (error) {
    console.error(
      '[admin/settings/active-payment-gateway] Failed to write setting:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to update active payment gateway.' }, { status: 500 });
  }
}
