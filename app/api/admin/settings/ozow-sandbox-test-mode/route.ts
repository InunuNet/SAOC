import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import {
  isOzowSandboxTestModeEnabled,
  OZOW_SANDBOX_TEST_MODE_COLLECTION,
  OZOW_SANDBOX_TEST_MODE_DOC_ID,
} from '@/lib/ozow-sandbox-test-mode';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

/**
 * GET/PUT /api/admin/settings/ozow-sandbox-test-mode -- owner-only Ozow sandbox amount-override
 * toggle (mission ozow-sandbox-toggle F1). Gated on getAdminSession() first, THEN
 * hasCapability(..., 'manage-payment-settings', ...), same call shape as
 * app/api/admin/vendors/route.ts. See contracts/golden/ozow-sandbox-toggle-f1/README.md §4.
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

  const enabled = await isOzowSandboxTestModeEnabled();
  return NextResponse.json({ enabled });
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

  if (
    typeof body !== 'object' ||
    body === null ||
    !('enabled' in body) ||
    typeof (body as { enabled: unknown }).enabled !== 'boolean'
  ) {
    return NextResponse.json({ error: 'Request body must be { enabled: boolean }.' }, { status: 400 });
  }

  const enabled = (body as { enabled: boolean }).enabled;

  try {
    const session = await getAdminSession();
    const email = session.ok ? session.decodedToken.email ?? null : null;
    const db = getFirestore(initAdmin());
    await db
      .collection(OZOW_SANDBOX_TEST_MODE_COLLECTION)
      .doc(OZOW_SANDBOX_TEST_MODE_DOC_ID)
      .set({ enabled, updatedAt: FieldValue.serverTimestamp(), updatedByEmail: email });
    return NextResponse.json({ enabled });
  } catch (error) {
    console.error(
      '[admin/settings/ozow-sandbox-test-mode] Failed to write flag:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to update Ozow sandbox test mode.' }, { status: 500 });
  }
}
