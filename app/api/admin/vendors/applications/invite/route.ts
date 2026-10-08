import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import {
  VENDOR_APPLICATIONS_COLLECTION,
  buildVendorApplicationInvite,
  validateVendorApplicationInviteInput,
} from '@/lib/vendor-applications';
import type { VendorApplicationInviteDraft } from '@/lib/vendor-applications';
import {
  generateVendorRegistrationCodeId,
  normalizeVendorCodeName,
  VENDOR_REGISTRATION_CODE_DEFAULT_TTL_MS,
} from '@/lib/vendor-registration-code';
import {
  claimVendorInviteEmailLock,
  VENDOR_INVITE_EMAIL_LOCKS_COLLECTION,
  vendorInviteEmailLockId,
} from '@/lib/vendor-invite-email-lock';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendVendorApprovalConfirmationEmail } from '@/lib/vendor-approval-confirmation';

/**
 * POST /api/admin/vendors/applications/invite -- admin-only "Invite a vendor" action (mission
 * vendor-invite, M1/F1). Same getAdminSession()-then-hasCapability(...,
 * 'review-vendor-applications', ...) gate as the sibling review/reissue-code routes in this
 * same directory tree -- no new capability string is introduced anywhere. Creates a
 * `vendorApplications` document ALREADY `approved` (`origin: 'invited'`) in a single atomic
 * transaction (lib/vendor-invite-email-lock.ts), mints the same existing 4-digit registration
 * code via the same mechanism the public apply-then-approve path uses, and sends it with the
 * same existing approval email -- no new email template, no new institutional copy.
 *
 * TOCTOU fix pass (2026-10-08, two rounds): round 1 closed the invite-vs-invite race with a
 * canonical-email guard document. Round 2 (Codex A10) found the duplicate-eligibility
 * full-collection scan still ran BEFORE the transaction opened, leaving a window for a PUBLIC
 * application (app/api/vendors/apply/route.ts, which has no guard doc at all) to commit
 * between the scan and this route's write. The scan now runs AS A TRANSACTIONAL QUERY READ
 * inside the SAME transaction as the guard claim and the create -- see
 * lib/vendor-invite-email-lock.ts's file-level comment for why a transactional query read
 * closes this without any change to the public-apply route.
 *
 * See .agent/memory/project/specs/vendor-invite/goldens/README.md for the full decision
 * record, including why status is written 'approved' directly (never a fake intermediate
 * 'pending'), the duplicate-invite eligibility rule, and why no admin-notice email fires here.
 */

/** Site URL fallback, matching app/api/admin/vendors/applications/[id]/review/route.ts's own
 *  DEFAULT_SITE_URL convention -- duplicated locally rather than imported, since that
 *  fallback is private to its own module and SITE_URL is only available at Firebase App
 *  Hosting runtime, not build time. */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function resolveSiteUrl(): string {
  return process.env['SITE_URL'] ?? DEFAULT_SITE_URL;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  const validation = validateVendorApplicationInviteInput(rawInput);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Invalid vendor invite submission.', fieldErrors: validation.errors },
      { status: 400 },
    );
  }
  const input = rawInput as VendorApplicationInviteDraft;

  const reviewerEmail = session.decodedToken.email;
  if (!reviewerEmail) {
    // Every real admin session already requires a verified email (isAdminToken) -- fail
    // closed rather than attribute this invite to nobody. Same guard, same wording as the
    // sibling review route.
    console.error(
      '[admin/vendors/applications/invite] Admin session has no email; refusing to attribute a review.',
    );
    return NextResponse.json({ error: 'Unable to attribute this review.' }, { status: 500 });
  }

  const db = getFirestore(initAdmin());

  // Shared operational precondition, checked before any write -- same reasoning and wording
  // pattern as the sibling review route's approve branch: every precondition the vendor will
  // need in order to REDEEM the code has to hold before the invite is created, not just the
  // preconditions of generating it.
  if (!process.env.VENDOR_REGISTRATION_TOKEN_SECRET) {
    console.error(
      '[admin/vendors/applications/invite] VENDOR_REGISTRATION_TOKEN_SECRET is unset; invite refused.',
    );
    return NextResponse.json(
      {
        error:
          'Cannot invite: VENDOR_REGISTRATION_TOKEN_SECRET is not configured, so the registration code could never be redeemed. No invite was created.',
      },
      { status: 503 },
    );
  }

  // Generate BEFORE committing anything -- same "generate before writing" rule as the sibling
  // review route's approve branch.
  const registrationCodeId = generateVendorRegistrationCodeId();
  const nameSlug = normalizeVendorCodeName(input.businessName);
  if (!nameSlug) {
    console.error(
      '[admin/vendors/applications/invite] Business name normalises to an empty code slug; invite refused.',
    );
    return NextResponse.json(
      {
        error:
          'Cannot invite: this business name contains no letters or digits, so the registration code could never be matched to it. Correct the business name first. No invite was created.',
      },
      { status: 409 },
    );
  }
  const expiresAt = new Date(now.getTime() + VENDOR_REGISTRATION_CODE_DEFAULT_TTL_MS);

  const built = buildVendorApplicationInvite(input, reviewerEmail, now);

  // Pre-allocate the new document's ref (auto-id, no write yet) so the SAME id can be passed
  // into the transaction below as `tx.create(newApplicationRef, ...)` -- Firestore transactions
  // have no `.add()`; a create needs a ref decided in advance. The lock-guard doc's id is a
  // deterministic hash of the canonical email, not a random id, so two concurrent requests for
  // the SAME email are guaranteed to contend on the SAME guard document.
  const applicationsCollection = db.collection(VENDOR_APPLICATIONS_COLLECTION);
  const newApplicationRef = applicationsCollection.doc();
  const lockRef = db
    .collection(VENDOR_INVITE_EMAIL_LOCKS_COLLECTION)
    .doc(vendorInviteEmailLockId(input.contactEmail));

  const newApplicationData = {
    ...built,
    submittedAt: Timestamp.fromDate(built.submittedAt),
    reviewedAt: built.reviewedAt ? Timestamp.fromDate(built.reviewedAt) : null,
    registrationCodeId,
    registrationCodeNameSlug: nameSlug,
    registrationCodeIssuedAt: Timestamp.fromDate(now),
    registrationCodeExpiresAt: Timestamp.fromDate(expiresAt),
    registrationCodeFailedAttempts: 0,
    registrationCodeLockedAt: null,
    registrationCodeGeneration: 1,
  };

  let lockResult;
  try {
    // ONE atomic transaction -- status 'approved', origin 'invited', and every code field land
    // together in the SAME create call, the duplicate-eligibility full-collection scan runs as
    // a transactional query read, AND the canonical-email guard doc is claimed, all in the SAME
    // transaction. There is no intermediate 'pending' state and no second write. See
    // lib/vendor-invite-email-lock.ts for why this closes both the invite-vs-invite and
    // invite-vs-public races.
    lockResult = await claimVendorInviteEmailLock(db, {
      contactEmail: input.contactEmail,
      lockRef,
      applicationsCollection,
      newApplicationRef,
      newApplicationId: newApplicationRef.id,
      newApplicationData,
    });
  } catch (error) {
    console.error(
      '[admin/vendors/applications/invite] Failed to save vendor invite:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to save vendor invite.' }, { status: 500 });
  }

  if (!lockResult.ok) {
    return NextResponse.json({ error: lockResult.error }, { status: 409 });
  }

  const registrationLink = `${resolveSiteUrl()}/national-show/vendors/register?name=${encodeURIComponent(input.businessName)}&code=${registrationCodeId}`;

  await deliverConfirmationEmailAfterCommit(
    () =>
      sendVendorApprovalConfirmationEmail({
        businessName: input.businessName,
        contactPersonName: input.contactPersonName,
        contactEmail: input.contactEmail,
        registrationCode: registrationCodeId,
        registrationLink,
      }),
    (error) => {
      console.error(
        '[admin/vendors/applications/invite] Failed to send approval confirmation email:',
        error instanceof Error ? error.message : 'unknown error',
      );
    },
  );

  return NextResponse.json(
    { success: true, id: newApplicationRef.id, registrationCodeId },
    { status: 201 },
  );
}
