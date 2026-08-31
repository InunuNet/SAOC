import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import {
  decideVendorApplicationTransition,
  type VendorApplicationReviewAction,
} from '@/lib/vendor-application-review';
import {
  generateVendorRegistrationCodeId,
  normalizeVendorCodeName,
  VENDOR_REGISTRATION_CODE_DEFAULT_TTL_MS,
} from '@/lib/vendor-registration-code';
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
 * On 'approve': REPOINTED 2026-09-01 (mission vendor-gated-registration-flow, M4/F24) from
 * minting an opaque HMAC token to generating a human-readable code -- see
 * contracts/golden/vendor-gated-registration-flow-m4/README.md for the full decision record.
 * The code is generated FIRST, BEFORE any write -- a generation failure must fail the whole
 * operation with the application still `pending`, since the review machine (correctly) refuses
 * to re-approve an already-approved application and an approved-with-no-code application would
 * otherwise be a terminal dead end no operator could clear from the UI. Only once a code exists
 * is a SINGLE additive patch applied, spreading F2's own 3-key patch alongside the code's
 * issued/expires timestamps and the code itself (F2's decideVendorApplicationTransition
 * contract is untouched -- it still returns exactly {status, reviewedBy, reviewedAt}; this
 * route merely writes them together so approval and code issuance can never land apart). THEN
 * the approval confirmation email (F6/F24, extended) is sent with the code (read-aloud
 * formatted) and a `?name=&code=` convenience link, and no booth/logistics fields at all --
 * none has been asked of the vendor yet, so every one of them (powerRequired included, now
 * nullable) is omitted and renders "Not specified" rather than asserting an answer the vendor
 * never gave.
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

  // Generate BEFORE committing anything. A generation failure here leaves the application
  // `pending` and recoverable -- the operator can retry the same approval. Never a partial
  // approval left `approved` with no code issued against it.
  let minted: { codeId: string; nameSlug: string; expiresAt: Date } | null = null;
  if (body.action === 'approve') {
    // M4 fix pass -- EVERY precondition the vendor will need in order to REDEEM the code has to
    // hold before the application leaves `pending`, not just the preconditions of generating it.
    // F24 moved the secret dependency from mint-time to verify-time
    // (app/api/vendors/register/verify-code/route.ts mints the session cookie) and this precheck
    // did not move with it, reintroducing M1's dead end in a new form: the approval commits, the
    // code is emailed, and every redemption fails with the deliberately generic 403 that hides
    // the real cause. The secret is only READ here (never used) precisely because this route no
    // longer mints anything -- it is an availability precondition, checked at the point of no
    // return. Fails closed with an operator-facing 503, application untouched and still pending.
    if (!process.env.VENDOR_REGISTRATION_TOKEN_SECRET) {
      console.error(
        '[admin/vendors/applications/review] VENDOR_REGISTRATION_TOKEN_SECRET is unset; approval refused (application left pending).',
      );
      return NextResponse.json(
        {
          error:
            'Cannot approve: VENDOR_REGISTRATION_TOKEN_SECRET is not configured, so the registration code could never be redeemed. The application is unchanged and still pending.',
        },
        { status: 503 },
      );
    }

    try {
      minted = {
        codeId: generateVendorRegistrationCodeId(),
        nameSlug: normalizeVendorCodeName(String(data.businessName ?? '')),
        expiresAt: new Date(now.getTime() + VENDOR_REGISTRATION_CODE_DEFAULT_TTL_MS),
      };
    } catch (error) {
      console.error(
        '[admin/vendors/applications/review] Failed to generate a registration code; approval refused (application left pending):',
        error instanceof Error ? error.message : 'unknown error',
      );
      return NextResponse.json(
        {
          error:
            'Cannot approve: failed to issue a registration code. The application is unchanged and still pending.',
        },
        { status: 500 },
      );
    }

    // Second precondition of the SAME class, found while checking for one. The vendor is looked
    // up at verify time by `registrationCodeNameSlug` (an equality match on the slug of whatever
    // they type). normalizeVendorCodeName() strips everything outside [a-z0-9], so a business
    // name that is entirely non-Latin or punctuation -- or a document with no businessName at
    // all -- normalises to the empty string. That commits an approval whose code no realistic
    // typed name can ever match: the same permanent, silent dead end. Refused before the
    // commit; the operator can correct the business name and approve again.
    if (!minted.nameSlug) {
      console.error(
        '[admin/vendors/applications/review] Business name normalises to an empty code slug; approval refused (application left pending).',
      );
      return NextResponse.json(
        {
          error:
            'Cannot approve: this business name contains no letters or digits, so the registration code could never be matched to it. Correct the business name first. The application is unchanged and still pending.',
        },
        { status: 409 },
      );
    }
  }

  try {
    // One additive patch: F2's 3-key decision plus, on approval, the code fields -- so an
    // application can never be left `approved` with no code issued against it.
    await ref.update(
      minted
        ? {
            ...decision.patch,
            registrationCodeId: minted.codeId,
            registrationCodeNameSlug: minted.nameSlug,
            registrationCodeIssuedAt: Timestamp.fromDate(now),
            registrationCodeExpiresAt: Timestamp.fromDate(minted.expiresAt),
            registrationCodeFailedAttempts: 0,
            registrationCodeLockedAt: null,
            // Every code mint bumps the generation, so a session minted against an earlier
            // code can never be claimed. FieldValue.increment is atomic and creates the field
            // at 1 on an application that has never held a code.
            registrationCodeGeneration: FieldValue.increment(1),
          }
        : decision.patch,
    );

    if (minted) {
      // Captured into a const so the closure below keeps TypeScript's narrowing -- `minted`
      // itself is a `let`, which loses narrowing inside a nested function expression.
      const mintedCode = minted;
      const registrationLink = `${resolveSiteUrl()}/national-show/vendors/register?name=${encodeURIComponent(String(data.businessName ?? ''))}&code=${mintedCode.codeId}`;

      await deliverConfirmationEmailAfterCommit(
        () =>
          sendVendorApprovalConfirmationEmail({
            businessName: data.businessName,
            contactPersonName: data.contactPersonName,
            contactEmail: data.contactEmail,
            registrationCode: mintedCode.codeId,
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
