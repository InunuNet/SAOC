import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';

/**
 * GET /api/admin/vendors/applications -- admin-only list of vendorApplications documents
 * (mission vendor-gated-registration-flow F5). Same getAdminSession()-then-hasCapability(...,
 * 'review-vendor-applications', ...) gate as app/api/admin/vendors/route.ts, wired
 * identically -- reuses the SAME capability, no new role. See
 * contracts/golden/vendor-gated-registration-flow-f1/README.md.
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
    const snapshot = await db.collection(VENDOR_APPLICATIONS_COLLECTION).get();
    const applications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ applications });
  } catch (error) {
    // Generic message + error.message only -- never the applications array or any single
    // application's fields, mirroring app/api/admin/vendors/route.ts's own "no PII in list
    // route logs" rule.
    console.error(
      '[admin/vendors/applications] Failed to list vendor applications:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to load vendor applications.' }, { status: 500 });
  }
}
