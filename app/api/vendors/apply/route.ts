import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import {
  VENDOR_APPLICATIONS_COLLECTION,
  buildVendorApplication,
  validateVendorApplicationInput,
} from '@/lib/vendor-applications';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendVendorApplicationConfirmationEmail } from '@/lib/vendor-application-confirmation';
import { sendVendorApplicationAdminNoticeEmail } from '@/lib/vendor-application-admin-notice';
import type { VendorApplicationDraft } from '@/types/index';

/**
 * POST /api/vendors/apply -- public, unauthenticated vendor application route (mission
 * vendor-gated-registration-flow F4). Writes a `vendorApplications` doc built by F1's
 * buildVendorApplication(), which forces `status` to the literal 'pending' -- never accepting
 * a caller-supplied status (VendorApplicationDraft structurally excludes it at the type
 * level; this route additionally never assigns anything but 'pending' when writing). See
 * contracts/golden/vendor-gated-registration-flow-f1/README.md.
 *
 * This is the SHORT application, not the full ~90-field registration -- committee review
 * happens here, before any vendor ever sees the full form (app/api/vendors/register/route.ts,
 * unchanged in M1, now gated by F7).
 *
 * G1 (vendor-flow-notifications) -- strictly AFTER the write below commits, fires the
 * vendor-facing "we received your application" confirmation and an admin notice, each
 * independently wrapped in the REAL deliverConfirmationEmailAfterCommit so a failed send never
 * fails this route. See contracts/golden/vendor-flow-notifications/README.md.
 */

/** Site URL fallback, matching lib/confirmation-email.ts's own DEFAULT_SITE_URL convention --
 *  duplicated locally rather than imported (that fallback is private to its own module and
 *  SITE_URL is runtime-only, not available at build time). */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function resolveSiteUrl(): string {
  return process.env['SITE_URL'] ?? DEFAULT_SITE_URL;
}
export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  const validation = validateVendorApplicationInput(rawInput);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Invalid vendor application submission.', fieldErrors: validation.errors },
      { status: 400 },
    );
  }

  const now = new Date();
  const built = buildVendorApplication(rawInput as VendorApplicationDraft, now);

  try {
    initAdmin();
    const ref = await getFirestore()
      .collection(VENDOR_APPLICATIONS_COLLECTION)
      .add({
        ...built,
        // Belt-and-braces alongside buildVendorApplication()'s own forced 'pending' -- the
        // literal is repeated here so this write can never regress to persisting anything
        // other than 'pending', even if buildVendorApplication() were ever refactored.
        status: 'pending',
        submittedAt: Timestamp.fromDate(built.submittedAt),
      });

    await deliverConfirmationEmailAfterCommit(
      () =>
        sendVendorApplicationConfirmationEmail({
          businessName: built.businessName,
          contactPersonName: built.contactPersonName,
          contactEmail: built.contactEmail,
        }),
      (error) => {
        console.error(
          '[vendors/apply/route] Application confirmation email failed (non-fatal):',
          error instanceof Error ? error.message : 'unknown error',
        );
      },
    );

    await deliverConfirmationEmailAfterCommit(
      () =>
        sendVendorApplicationAdminNoticeEmail({
          businessName: built.businessName,
          contactPersonName: built.contactPersonName,
          applicationId: ref.id,
          reviewUrl: `${resolveSiteUrl()}/admin/vendors/applications`,
        }),
      (error) => {
        console.error(
          '[vendors/apply/route] Application admin notice email failed (non-fatal):',
          error instanceof Error ? error.message : 'unknown error',
        );
      },
    );

    return NextResponse.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    console.error(
      '[vendors/apply/route] Failed to save vendor application:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json(
      { error: 'Failed to save vendor application. Please try again.' },
      { status: 500 },
    );
  }
}
