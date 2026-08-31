import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import {
  decideVendorApplicationTransition,
  type VendorApplicationReviewAction,
} from '@/lib/vendor-application-review';
import { mintVendorRegistrationToken } from '@/lib/vendor-registration-token';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendVendorApprovalConfirmationEmail } from '@/lib/vendor-approval-confirmation';
import type { VendorApplicationStatus } from '@/types/index';

/**
 * POST /api/admin/vendors/applications/[id]/review -- admin-only status-transition action
 * (mission vendor-gated-registration-flow F5). Same getAdminSession-then-hasCapability gate as
 * app/api/admin/vendors/[id]/review/route.ts, wired identically. The REAL
 * decideVendorApplicationTransition() (lib/vendor-application-review.ts, F2) is the ONLY place
 * the pending/approved/declined machine is evaluated -- never reimplemented here. ref.update()
 * is used for every write -- never a full-document overwrite -- so each patch can only ADD to
 * the document.
 *
 * On 'approve': the registration secret is resolved and the token MINTED FIRST, BEFORE any
 * write -- a missing secret or a minting failure must fail the whole operation with the
 * application still `pending`, since the review machine (correctly) refuses to re-approve an
 * already-approved application and an approved-with-no-link application would otherwise be a
 * terminal dead end no operator could clear from the UI. Only once a token exists is a SINGLE
 * additive patch applied, spreading F2's own 3-key patch alongside the token's issued/expires
 * timestamps (F2's decideVendorApplicationTransition contract is untouched -- it still returns
 * exactly {status, reviewedBy, reviewedAt}; this route merely writes them together so approval
 * and token issuance can never land apart). THEN the approval confirmation email (F6,
 * extended) is sent with a registrationLink built from the minted token, and no
 * booth/logistics fields at all -- none has been asked of the vendor yet, so every one of them
 * (powerRequired included, now nullable) is omitted and renders "Not specified" rather than
 * asserting an answer the vendor never gave.
 *
 * On 'decline': F2's decision only -- no email in M1 (a decline notification is a reasonable
 * M2 addition, not blocking the demo). See
 * contracts/golden/vendor-gated-registration-flow-f1/README.md.
 */
const VALID_ACTIONS: readonly VendorApplicationReviewAction[] = ['approve', 'decline'];

/** Site URL fallback, matching lib/confirmation-email.ts's own DEFAULT_SITE_URL convention --
 *  duplicated locally rather than imported, since that fallback is private to its own module
 *  and SITE_URL is only available at Firebase App Hosting runtime, not build time. */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function resolveSiteUrl(): string {
  return process.env['SITE_URL'] ?? DEFAULT_SITE_URL;
}

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

  if (typeof body.action !== 'string' || !VALID_ACTIONS.includes(body.action as VendorApplicationReviewAction)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  const reviewerEmail = session.decodedToken.email;
  if (!reviewerEmail) {
    // Every real admin session already requires a verified email (isAdminToken) -- fail
    // closed rather than attribute a review decision to nobody.
    console.error(
      '[admin/vendors/applications/review] Admin session has no email; refusing to attribute a review.',
    );
    return NextResponse.json({ error: 'Unable to attribute this review.' }, { status: 500 });
  }

  const db = getFirestore(initAdmin());
  const ref = db.collection(VENDOR_APPLICATIONS_COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: 'Vendor application not found.' }, { status: 404 });
  }

  const data = snapshot.data() ?? {};
  const currentStatus = data.status as VendorApplicationStatus;
  const decision = decideVendorApplicationTransition({
    currentStatus,
    action: body.action as VendorApplicationReviewAction,
    reviewerEmail,
    now,
  });

  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: 409 });
  }

  // Mint BEFORE committing anything. A missing secret or a minting failure here leaves the
  // application `pending` and recoverable -- the operator can retry the same approval once the
  // secret is configured. Never a silent fallback secret, never a partial approval.
  let minted: ReturnType<typeof mintVendorRegistrationToken> | null = null;
  if (body.action === 'approve') {
    const secret = process.env.VENDOR_REGISTRATION_TOKEN_SECRET;
    if (!secret) {
      console.error(
        '[admin/vendors/applications/review] VENDOR_REGISTRATION_TOKEN_SECRET is unset; refusing to approve (application left pending).',
      );
      return NextResponse.json(
        {
          error:
            'Cannot approve: VENDOR_REGISTRATION_TOKEN_SECRET is not configured, so no registration link can be issued. The application is unchanged and still pending.',
        },
        { status: 503 },
      );
    }

    try {
      minted = mintVendorRegistrationToken({ applicationId: id, secret, now });
    } catch (error) {
      console.error(
        '[admin/vendors/applications/review] Failed to mint a registration token; approval refused (application left pending):',
        error instanceof Error ? error.message : 'unknown error',
      );
      return NextResponse.json(
        {
          error:
            'Cannot approve: failed to issue a registration link. The application is unchanged and still pending.',
        },
        { status: 500 },
      );
    }
  }

  try {
    // One additive patch: F2's 3-key decision plus, on approval, the token timestamps -- so an
    // application can never be left `approved` with no token issued against it.
    await ref.update(
      minted
        ? {
            ...decision.patch,
            registrationTokenIssuedAt: Timestamp.fromDate(now),
            registrationTokenExpiresAt: Timestamp.fromDate(minted.expiresAt),
          }
        : decision.patch,
    );

    if (minted) {
      const registrationLink = `${resolveSiteUrl()}/national-show/vendors/register?token=${minted.token}`;

      await deliverConfirmationEmailAfterCommit(
        () =>
          sendVendorApprovalConfirmationEmail({
            businessName: data.businessName,
            contactPersonName: data.contactPersonName,
            contactEmail: data.contactEmail,
            registrationLink,
          }),
        (error) => {
          console.error(
            '[admin/vendors/applications/review] Failed to send approval confirmation email:',
            error instanceof Error ? error.message : 'unknown error',
          );
        },
      );
    }

    return NextResponse.json({ success: true, status: decision.patch.status });
  } catch (error) {
    console.error(
      '[admin/vendors/applications/review] Failed to apply status transition:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to update vendor application.' }, { status: 500 });
  }
}
