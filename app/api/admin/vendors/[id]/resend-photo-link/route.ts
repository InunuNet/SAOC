import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { mintVendorPhotoUploadUrl } from '@/lib/vendor-photo-resume-link';
import { nosOrigin } from '@/lib/site-hosts';

/**
 * POST /api/admin/vendors/[id]/resend-photo-link -- gives an admin a fresh photo-resume link
 * for a vendor who never received, or lost, the one in their registration-received email
 * (mission vendor-flow-fixes, F2). Same getAdminSession()-then-hasCapability gate as
 * resend-payment-link (no new capability).
 *
 * ALWAYS mints a fresh link, sends no email and writes nothing: the admin copies the returned
 * `photoUrl` to the vendor. Refused for rejected submissions and ones already holding all 3
 * product photos.
 */
export async function POST(
  _request: NextRequest,
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

  const db = getFirestore(initAdmin());
  const submissionSnapshot = await db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(id).get();
  if (!submissionSnapshot.exists) {
    return NextResponse.json({ error: 'Vendor submission not found.' }, { status: 404 });
  }

  const data = submissionSnapshot.data() ?? {};
  if (data.status === 'rejected') {
    return NextResponse.json(
      { error: 'Cannot generate a photo upload link: this submission has been rejected.' },
      { status: 409 },
    );
  }

  const hasAllProductPhotos = [data.productPhoto1Path, data.productPhoto2Path, data.productPhoto3Path].every(
    (path) => typeof path === 'string' && path.length > 0,
  );
  if (hasAllProductPhotos) {
    return NextResponse.json(
      { error: 'Cannot generate a photo upload link: this submission already has all 3 product photos.' },
      { status: 409 },
    );
  }

  const secret = process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[admin/vendors/resend-photo-link] VENDOR_STAND_PAYMENT_TOKEN_SECRET is unset; link refused.',
    );
    return NextResponse.json(
      {
        error:
          'Cannot generate a photo upload link: VENDOR_STAND_PAYMENT_TOKEN_SECRET is not configured, so a new link could never be redeemed.',
      },
      { status: 503 },
    );
  }

  const { url } = mintVendorPhotoUploadUrl({
    vendorSubmissionId: id,
    secret,
    now,
    siteUrl: nosOrigin(),
  });

  return NextResponse.json({ success: true, photoUrl: url });
}
