import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { decideVendorStatusTransition, type VendorReviewAction } from '@/lib/vendor-review';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendVendorApprovalConfirmationEmail } from '@/lib/vendor-approval-confirmation';
import { mintVendorStandPaymentToken } from '@/lib/vendor-stand-payment-token';
import { sendVendorStandPaymentNoticeEmail } from '@/lib/vendor-stand-payment-notice';
import type { VendorSubmissionStatus } from '@/types/index';

/**
 * POST /api/admin/vendors/[id]/review -- admin-only status-transition action (mission
 * vendor-registration F6), extended by F8 to send the vendor approval confirmation email
 * strictly after the status-transition write commits, ONLY for the 'approve' action. Same
 * getAdminSession-then-hasCapability gate as app/api/admin/vendors/route.ts, wired
 * identically. The REAL decideVendorStatusTransition() (lib/vendor-review.ts, F6) is the ONLY
 * place the submitted/under-review/approved/rejected machine is evaluated -- never
 * reimplemented here. ref.update(decision.patch) is used -- a full-document overwrite is
 * never used -- so the 3-key patch can only ever ADD to the document, never wipe the other 31
 * submitted fields. See contracts/golden/vendor-f6-review-workflow/README.md and
 * contracts/golden/vendor-f8-approval-email/README.md.
 *
 * M3/F28 -- extends the 'approve' action with a SECOND, equally non-blocking post-commit step:
 * mint a stand-payment token (lib/vendor-stand-payment-token.ts) and send
 * emails/VendorStandPaymentReady.tsx. Deliberately NOT fail-closed the way M1's application
 * token mint is -- the submission's 'approved' status is already committed by the time this
 * runs, and gating THAT commit on the payment-token secret would wrongly couple two
 * independent decisions. See the M3 golden README's "Approval triggers the mint".
 */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function resolveSiteUrl(): string {
  return process.env.SITE_URL?.trim().replace(/\/+$/, '') || DEFAULT_SITE_URL;
}

function buildVendorStandPaymentUrl(token: string): string {
  return `${resolveSiteUrl()}/national-show/vendors/payment?token=${encodeURIComponent(token)}`;
}
const VALID_ACTIONS: readonly VendorReviewAction[] = ['start-review', 'approve', 'reject'];

interface ReviewRequestBody {
  action?: unknown;
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

  let body: ReviewRequestBody;
  try {
    body = (await request.json()) as ReviewRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body.action !== 'string' || !VALID_ACTIONS.includes(body.action as VendorReviewAction)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  const reviewerEmail = session.decodedToken.email;
  if (!reviewerEmail) {
    // Every real admin session already requires a verified email (isAdminToken) -- fail
    // closed rather than attribute a review decision to nobody.
    console.error('[admin/vendors/review] Admin session has no email; refusing to attribute a review.');
    return NextResponse.json({ error: 'Unable to attribute this review.' }, { status: 500 });
  }

  const db = getFirestore(initAdmin());
  const ref = db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: 'Vendor submission not found.' }, { status: 404 });
  }

  const currentStatus = snapshot.data()?.status as VendorSubmissionStatus;
  const decision = decideVendorStatusTransition({
    currentStatus,
    action: body.action as VendorReviewAction,
    reviewerEmail,
    now,
  });

  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: 409 });
  }

  try {
    await ref.update(decision.patch);

    if (body.action === 'approve') {
      const data = snapshot.data() ?? {};
      await deliverConfirmationEmailAfterCommit(
        () =>
          sendVendorApprovalConfirmationEmail({
            businessName: data.businessName,
            contactPersonName: data.contactPersonName,
            contactEmail: data.contactEmail,
            boothNumber: data.boothNumber ?? null,
            boothType: data.boothType ?? null,
            staffPerDay: data.staffPerDay ?? null,
            powerRequired: data.powerRequired,
            waterRequired: data.waterRequired ?? null,
            loadInSlot: data.loadInSlot ?? null,
            loadOutSlot: data.loadOutSlot ?? null,
          }),
        (error) => {
          console.error(
            '[admin/vendors/review] Failed to send approval confirmation email:',
            error instanceof Error ? error.message : 'unknown error',
          );
        },
      );

      // M3/F28 -- second, independent post-commit step. A missing secret or a mailer failure
      // here is logged and non-fatal: the approval write above already committed and must
      // never be rolled back or hidden behind an error because this follow-on step failed. An
      // operator can always recover a lost/failed send via
      // POST /api/admin/vendors/[id]/resend-payment-link.
      const paymentTokenSecret = process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
      if (!paymentTokenSecret) {
        console.error(
          '[admin/vendors/review] VENDOR_STAND_PAYMENT_TOKEN_SECRET is unset; stand-payment link not sent (approval unaffected).',
        );
      } else {
        await deliverConfirmationEmailAfterCommit(
          () => {
            const { token } = mintVendorStandPaymentToken({
              vendorSubmissionId: id,
              secret: paymentTokenSecret,
              now,
            });
            return sendVendorStandPaymentNoticeEmail({
              businessName: data.businessName,
              contactPersonName: data.contactPersonName,
              contactEmail: data.contactEmail,
              paymentUrl: buildVendorStandPaymentUrl(token),
            });
          },
          (error) => {
            console.error(
              '[admin/vendors/review] Failed to send stand-payment link email:',
              error instanceof Error ? error.message : 'unknown error',
            );
          },
        );
      }
    }

    return NextResponse.json({ success: true, status: decision.patch.status });
  } catch (error) {
    console.error(
      '[admin/vendors/review] Failed to apply status transition:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to update vendor submission.' }, { status: 500 });
  }
}
