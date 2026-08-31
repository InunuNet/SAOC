import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import {
  VENDOR_APPLICATIONS_COLLECTION,
  buildVendorApplication,
  validateVendorApplicationInput,
} from '@/lib/vendor-applications';
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
 */
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
