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
import { decideVendorApplicationInviteEligibility } from '@/lib/vendor-application-invite-eligibility';
import type { VendorApplicationInviteCandidate } from '@/lib/vendor-application-invite-eligibility';
import {
  generateVendorRegistrationCodeId,
  normalizeVendorCodeName,
  VENDOR_REGISTRATION_CODE_DEFAULT_TTL_MS,
} from '@/lib/vendor-registration-code';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendVendorApprovalConfirmationEmail } from '@/lib/vendor-approval-confirmation';
import type { VendorApplicationStatus } from '@/types/index';

/**
 * POST /api/admin/vendors/applications/invite -- admin-only "Invite a vendor" action (mission
 * vendor-invite, M1/F1). Same getAdminSession()-then-hasCapability(...,
 * 'review-vendor-applications', ...) gate as the sibling review/reissue-code routes in this
 * same directory tree -- no new capability string is introduced anywhere. Creates a
 * `vendorApplications` document ALREADY `approved` (`origin: 'invited'`) in a single `.add()`
 * call, mints the same existing 4-digit registration code via the same mechanism the public
 * apply-then-approve path uses, and sends it with the same existing approval email -- no new
 * email template, no new institutional copy.
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

  // Full-collection scan, not an indexed query -- Firestore's equality where() is
  // case-sensitive, so a case-insensitive duplicate check cannot be expressed as a single
  // indexed query without a second, lowercased mirror field. Same accepted tradeoff the
  // existing GET list route already makes at this collection's expected volume (dozens of
  // invites per show cycle). See goldens/README.md "Known, accepted limitation".
  let candidates: VendorApplicationInviteCandidate[];
  try {
    const snapshot = await db.collection(VENDOR_APPLICATIONS_COLLECTION).get();
    candidates = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status as VendorApplicationStatus,
        contactEmail: String(data.contactEmail ?? ''),
      };
    });
  } catch (error) {
    console.error(
      '[admin/vendors/applications/invite] Failed to load existing vendor applications for the duplicate check:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to save vendor invite.' }, { status: 500 });
  }

  const eligibility = decideVendorApplicationInviteEligibility(input.contactEmail, candidates);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 409 });
  }

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

  try {
    // ONE atomic write -- status 'approved', origin 'invited', and every code field land
    // together in the SAME create call. There is no intermediate 'pending' state and no
    // second write.
    const ref = await db.collection(VENDOR_APPLICATIONS_COLLECTION).add({
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
    });

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

    return NextResponse.json({ success: true, id: ref.id, registrationCodeId }, { status: 201 });
  } catch (error) {
    console.error(
      '[admin/vendors/applications/invite] Failed to save vendor invite:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to save vendor invite.' }, { status: 500 });
  }
}
