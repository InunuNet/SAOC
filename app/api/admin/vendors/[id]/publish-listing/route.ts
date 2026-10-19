import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { publishVendorListing } from '@/lib/vendor-listing';
import { createListingSanityClient, SanityNotConfiguredError } from '@/lib/vendor-listing-sanity';
import type { VendorSubmission } from '@/types/index';

export const runtime = 'nodejs';

/**
 * POST /api/admin/vendors/[id]/publish-listing -- admin-only (F30, launch-weekend). Copies the
 * allowlisted projection of an eligible vendor submission into Sanity as a vendorNursery
 * document, create-once (lib/vendor-listing.ts). Same getAdminSession-then-hasCapability gate as
 * the review route. The audit fields are written with ref.update, only when a document was
 * created; an audit failure is logged and never undoes the idempotent Sanity create.
 */
interface PublishListingBody {
  acknowledgeNoConsent?: unknown;
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

  let body: PublishListingBody = {};
  try {
    body = (await request.json()) as PublishListingBody;
  } catch {
    // An empty body is valid: acknowledgeNoConsent defaults to false.
  }

  const db = getFirestore(initAdmin());
  const ref = db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: 'Vendor submission not found.' }, { status: 404 });
  }
  // Admin SDK snapshot data; fields read by publishVendorListing are optional-safe.
  const submission = { ...(snapshot.data() as Omit<VendorSubmission, 'id'>), id };

  let result;
  try {
    result = await publishVendorListing(
      { sanity: createListingSanityClient() },
      { submission, acknowledgeNoConsent: body.acknowledgeNoConsent === true },
    );
  } catch (error) {
    if (error instanceof SanityNotConfiguredError) {
      console.error('[admin/vendors/publish-listing] SANITY_API_TOKEN is unset.');
      return NextResponse.json({ error: 'CMS not configured' }, { status: 500 });
    }
    console.error(
      '[admin/vendors/publish-listing] Publish failed:',
      id,
      error instanceof Error ? error.name : 'unknown error',
    );
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 });
  }

  if (!result.ok) {
    const error =
      result.reason === 'not-eligible' ? 'Not eligible for the listing' : 'No consent signal';
    return NextResponse.json({ error, reason: result.reason }, { status: 409 });
  }

  if (result.outcome === 'created') {
    try {
      await ref.update({
        listingPublishedAt: now,
        listingPublishedBy: session.decodedToken.email ?? null,
        listingDocumentId: result.documentId,
      });
    } catch (error) {
      console.error(
        '[admin/vendors/publish-listing] Audit write failed:',
        id,
        error instanceof Error ? error.name : 'unknown error',
      );
    }
  }

  return NextResponse.json({ success: true, outcome: result.outcome, documentId: result.documentId });
}
