import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { VENDOR_STAND_ORDERS_COLLECTION } from '@/lib/vendor-stand-orders';
import { mintVendorStandPaymentToken } from '@/lib/vendor-stand-payment-token';
import { sendVendorStandPaymentNoticeEmail } from '@/lib/vendor-stand-payment-notice';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';

/**
 * POST /api/admin/vendors/[id]/resend-payment-link -- the escape hatch for a lost/failed
 * stand-payment email (mission vendor-gated-registration-flow, M3/F28). Same
 * getAdminSession()-then-hasCapability gate as the review route (no new capability invented).
 * See contracts/golden/vendor-gated-registration-flow-m3/README.md "Approval triggers the
 * mint" for the full decision record.
 *
 * Same "reissue, not unlock" shape as F25 (M4)'s reissue-code route -- ALWAYS mints a fresh
 * token and re-sends, never a "view the existing link" mechanism. Callable any time the
 * submission is currently 'approved' and its stand order (if any) is not yet 'paid'.
 *
 * Hotfix (contracts/golden/vendor-stand-payment-link-visibility, 2026-09-01) -- the only
 * existing delivery path was a broken email send (forms.saoc.co.za unverified in Resend), so
 * the minted link reached nobody. The response now always returns `paymentUrl` on success, and
 * the email send is non-fatal (same deliverConfirmationEmailAfterCommit pattern as the review
 * route) so a Resend failure never blocks the admin from getting the URL back.
 */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function resolveSiteUrl(): string {
  return process.env.SITE_URL?.trim().replace(/\/+$/, '') || DEFAULT_SITE_URL;
}

function buildVendorStandPaymentUrl(token: string): string {
  return `${resolveSiteUrl()}/national-show/vendors/payment?token=${encodeURIComponent(token)}`;
}

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
  const submissionRef = db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(id);
  const submissionSnapshot = await submissionRef.get();
  if (!submissionSnapshot.exists) {
    return NextResponse.json({ error: 'Vendor submission not found.' }, { status: 404 });
  }

  const data = submissionSnapshot.data() ?? {};
  if (data.status !== 'approved') {
    return NextResponse.json(
      { error: 'Cannot resend a payment link: this submission is not approved.' },
      { status: 409 },
    );
  }

  const standOrderSnapshot = await db.collection(VENDOR_STAND_ORDERS_COLLECTION).doc(id).get();
  if (standOrderSnapshot.exists && standOrderSnapshot.data()?.status === 'paid') {
    return NextResponse.json(
      { error: 'Cannot resend a payment link: this stand has already been paid for.' },
      { status: 409 },
    );
  }

  const secret = process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[admin/vendors/resend-payment-link] VENDOR_STAND_PAYMENT_TOKEN_SECRET is unset; resend refused.',
    );
    return NextResponse.json(
      {
        error:
          'Cannot resend a payment link: VENDOR_STAND_PAYMENT_TOKEN_SECRET is not configured, so a new link could never be redeemed.',
      },
      { status: 503 },
    );
  }

  // ALWAYS mints fresh -- never re-reads or re-derives a prior token. See "reissue, not
  // unlock" above.
  const { token } = mintVendorStandPaymentToken({ vendorSubmissionId: id, secret, now });
  const paymentUrl = buildVendorStandPaymentUrl(token);

  // Email delivery is non-fatal -- a broken mailer must never block returning paymentUrl to
  // the admin, since this route IS the recovery path when email delivery is the thing that's
  // broken. See "Hotfix" note above.
  await deliverConfirmationEmailAfterCommit(
    () =>
      sendVendorStandPaymentNoticeEmail({
        businessName: data.businessName,
        contactPersonName: data.contactPersonName,
        contactEmail: data.contactEmail,
        paymentUrl,
      }),
    (error) => {
      console.error(
        '[admin/vendors/resend-payment-link] Failed to send stand-payment link email:',
        error instanceof Error ? error.message : 'unknown error',
      );
    },
  );

  return NextResponse.json({ success: true, paymentUrl });
}
