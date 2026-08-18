import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';

/**
 * GET /api/admin/vendors -- admin-only list of vendorSubmissions documents (mission
 * vendor-registration F6). Gated on getAdminSession() first, THEN
 * hasCapability(..., 'review-vendor-applications', ...) with a REAL, awaited
 * resolveShowWindowLookup() result -- comp route's exact wiring
 * (app/api/admin/tickets/comp/route.ts). See
 * contracts/golden/vendor-f6-review-workflow/README.md.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session.ok) {
    const status = session.reason === 'no-session' || session.reason === 'invalid-session' ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
  }

  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  if (!hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'review-vendor-applications', { now, lookupShowWindow })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = getFirestore(initAdmin());
    const snapshot = await db.collection(VENDOR_SUBMISSIONS_COLLECTION).get();
    const submissions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ submissions });
  } catch (error) {
    // Generic message + error.message only -- never the submissions array or any single
    // submission's fields. See contracts/golden/vendor-f6-review-workflow/README.md "No PII
    // in list route logs."
    console.error(
      '[admin/vendors] Failed to list vendor submissions:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to load vendor submissions.' }, { status: 500 });
  }
}
