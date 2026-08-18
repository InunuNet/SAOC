import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { decideVendorPaymentUpdate } from '@/lib/vendor-payment';
import type { VendorSubmissionStatus } from '@/types/index';

/**
 * POST /api/admin/vendors/[id]/payment -- admin-only office-use payment/booth-allocation
 * action (mission vendor-registration F7). Same getAdminSession-then-hasCapability gate as
 * app/api/admin/vendors/[id]/review/route.ts, reusing 'review-vendor-applications' -- this is
 * the same back-office triage capability, not a new one. The REAL decideVendorPaymentUpdate()
 * (lib/vendor-payment.ts, F7) is the ONLY place the approved-status gate and booth-uniqueness
 * check are evaluated -- never reimplemented here. ref.update(decision.patch) is used -- a
 * full-document overwrite is never used, which would wipe every other field on the document.
 * See contracts/golden/vendor-f7-payment-path/README.md.
 */
interface PaymentRequestBody {
  boothNumber?: unknown;
  paymentReceived?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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

  const { id } = await params;
  const body = (await request.json()) as PaymentRequestBody;

  const db = getFirestore(initAdmin());
  const ref = db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: 'Vendor submission not found.' }, { status: 404 });
  }

  const data = snapshot.data();
  const currentStatus = data?.status as VendorSubmissionStatus;
  const thisBoothNumber = data?.boothNumber as string | null | undefined;

  const otherApproved = await db
    .collection(VENDOR_SUBMISSIONS_COLLECTION)
    .where('status', '==', 'approved')
    .get();
  const allocatedBoothNumbers = otherApproved.docs
    .filter((doc) => doc.id !== id)
    .map((doc) => doc.data().boothNumber as string | null | undefined)
    .filter((value): value is string => Boolean(value));

  const decision = decideVendorPaymentUpdate({
    currentStatus,
    boothNumber: typeof body.boothNumber === 'string' ? body.boothNumber : thisBoothNumber,
    paymentReceived: typeof body.paymentReceived === 'boolean' ? body.paymentReceived : undefined,
    confirmedBy: session.decodedToken.email ?? '',
    now,
    allocatedBoothNumbers,
  });

  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: 409 });
  }

  try {
    await ref.update(decision.patch);
    return NextResponse.json({ success: true, boothNumber: decision.patch.boothNumber });
  } catch (error) {
    console.error(
      '[admin/vendors/payment] Failed to apply payment update:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to update vendor submission.' }, { status: 500 });
  }
}
