import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import {
  generateVendorRegistrationCodeId,
  normalizeVendorCodeName,
  VENDOR_REGISTRATION_CODE_DEFAULT_TTL_MS,
} from '@/lib/vendor-registration-code';

/**
 * POST /api/admin/vendors/applications/[id]/reissue-code -- mission
 * vendor-gated-registration-flow, M4/F25. Same getAdminSession()-then-hasCapability gate as the
 * existing review route (no new capability invented). See
 * contracts/golden/vendor-gated-registration-flow-m4/README.md's "Reissue, not unlock" for the
 * full decision record.
 *
 * ONE operator action covers both "vendor is locked out" and "vendor lost the email" --
 * available any time status === 'approved', NOT conditioned on registrationCodeLockedAt being
 * set. Always: mints a fresh registrationCodeId, resets registrationCodeFailedAttempts to 0,
 * clears registrationCodeLockedAt, refreshes registrationCodeIssuedAt/registrationCodeExpiresAt
 * -- a single additive ref.update() patch, never a full-document overwrite. There is
 * deliberately no separate "unlock" action.
 *
 * It ALSO bumps registrationCodeGeneration, which is what makes a reissue an actual
 * revocation of any session already minted from the previous code -- see the field's comment
 * in the patch below.
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
  const ref = db.collection(VENDOR_APPLICATIONS_COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: 'Vendor application not found.' }, { status: 404 });
  }

  const data = snapshot.data() ?? {};
  if (data.status !== 'approved') {
    return NextResponse.json(
      { error: 'Cannot reissue a code: this application is not approved.' },
      { status: 409 },
    );
  }

  // Same two redemption preconditions the approval route checks before it commits, applied here
  // for the same reason: a reissue is what an operator reaches for when something has ALREADY
  // gone wrong for a vendor, so minting a code that can never be redeemed fails at the worst
  // possible moment. Both refuse before the single ref.update(), leaving the application's
  // existing code, lockout state and generation exactly as they were.
  if (!process.env.VENDOR_REGISTRATION_TOKEN_SECRET) {
    console.error(
      '[admin/vendors/applications/reissue-code] VENDOR_REGISTRATION_TOKEN_SECRET is unset; reissue refused (application unchanged).',
    );
    return NextResponse.json(
      {
        error:
          'Cannot reissue a code: VENDOR_REGISTRATION_TOKEN_SECRET is not configured, so the new code could never be redeemed. The application is unchanged.',
      },
      { status: 503 },
    );
  }

  const registrationCodeId = generateVendorRegistrationCodeId();
  const registrationCodeNameSlug = normalizeVendorCodeName(String(data.businessName ?? ''));
  const registrationCodeExpiresAt = new Date(now.getTime() + VENDOR_REGISTRATION_CODE_DEFAULT_TTL_MS);

  // normalizeVendorCodeName strips everything outside [a-z0-9], so a business name that is
  // entirely non-Latin or punctuation -- or a document with no businessName -- normalises to
  // the empty string, and the verify-time equality lookup on this slug could never match any
  // realistic typed name.
  if (!registrationCodeNameSlug) {
    console.error(
      '[admin/vendors/applications/reissue-code] Business name normalises to an empty code slug; reissue refused (application unchanged).',
    );
    return NextResponse.json(
      {
        error:
          'Cannot reissue a code: this business name contains no letters or digits, so the new code could never be matched to it. Correct the business name first. The application is unchanged.',
      },
      { status: 409 },
    );
  }

  try {
    await ref.update({
      registrationCodeId,
      registrationCodeNameSlug,
      registrationCodeIssuedAt: Timestamp.fromDate(now),
      registrationCodeExpiresAt: Timestamp.fromDate(registrationCodeExpiresAt),
      registrationCodeFailedAttempts: 0,
      registrationCodeLockedAt: null,
      // M4 fix pass -- REVOCATION, not just re-issuance. Bumping the generation invalidates
      // every vendor_registration_session cookie already minted against the OLD code: those
      // sessions carry the old generation in their signed payload and are refused by both the
      // register page's gate and POST /api/vendors/register's claim. Without this, a code
      // reissued precisely because it leaked or was being guessed left the holder of an
      // outstanding session with up to 30 more minutes of access.
      registrationCodeGeneration: FieldValue.increment(1),
    });
  } catch (error) {
    console.error(
      '[admin/vendors/applications/reissue-code] Failed to reissue a registration code:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json({ error: 'Failed to reissue a registration code.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, registrationCodeId });
}
