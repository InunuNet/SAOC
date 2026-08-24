# Golden: `app/api/admin/settings/active-payment-gateway/route.ts`

New file. Byte-shape mirrors `app/api/admin/settings/ozow-sandbox-test-mode/route.ts` exactly,
substituting the boolean flag for the gateway string. See README §6.

```ts
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

// checkGate(): identical shape to ozow-sandbox-test-mode/route.ts's checkGate() — same
// getAdminSession() -> hasCapability(..., 'manage-payment-settings', ...) gate. No new
// capability. (Body omitted here — copy that function verbatim.)

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
    console.error('[admin/settings/active-payment-gateway] Failed to write setting:', error);
    return NextResponse.json({ error: 'Failed to update active payment gateway.' }, { status: 500 });
  }
}
```
