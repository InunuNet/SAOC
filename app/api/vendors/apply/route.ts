import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { initAdmin } from '@/lib/firebase-admin';
import { consumeRateLimit } from '@/lib/newsletter-rate-limit';
import { createAttemptStore, scopeAttemptsToRequest } from '@/lib/newsletter-rate-store';
import {
  PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_FORM_RATE_LIMIT_WINDOW_MS,
} from '@/lib/public-form-rate-limit';
import { isBodyWithinLimit, isHoneypotHit } from '@/lib/request-guards';
import {
  VENDOR_APPLICATIONS_COLLECTION,
  buildVendorApplication,
  validateVendorApplicationInput,
} from '@/lib/vendor-applications';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendVendorApplicationConfirmationEmail } from '@/lib/vendor-application-confirmation';
import { sendVendorApplicationAdminNoticeEmail } from '@/lib/vendor-application-admin-notice';
import type { VendorApplicationDraft } from '@/types/index';
import { saocUrl } from '@/lib/site-hosts';

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

const attempts = createAttemptStore(PUBLIC_FORM_RATE_LIMIT_WINDOW_MS);

// Cap on the request body, checked against Content-Length before the body is buffered.
const MAX_BODY_BYTES = 16384;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isBodyWithinLimit(request.headers.get('content-length'), MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  const limit = consumeRateLimit(
    { now: new Date(), ...scopeAttemptsToRequest(attempts) },
    `vendor-apply:${ip ?? 'unknown'}`,
    PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS,
    PUBLIC_FORM_RATE_LIMIT_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  // A bot filled the hidden field: answer as if it worked, store and send nothing.
  if (isHoneypotHit(rawInput)) {
    return NextResponse.json({ success: true }, { status: 201 });
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
          reviewUrl: saocUrl('/admin/vendors/applications'),
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
