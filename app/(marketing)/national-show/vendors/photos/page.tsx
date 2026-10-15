import type { Metadata } from 'next';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { NosHero } from '@/components/nos/NosHero';
import { VendorPhotoResumeUploads } from '@/components/vendors/VendorPhotoResumeUploads';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { resolveVendorPhotoResumeState } from '@/lib/vendor-photo-resume-gate';
import { buildPageMetadata } from '@/lib/seo';

/**
 * Public product-photo resume page (mission vendor-flow-fixes, F2). Token-gated via a `?token=`
 * search param: the registration code is single-use and is consumed when the full form is
 * submitted, so a vendor who left before uploading all 3 photos returns here instead. The
 * token authorises only this page for its own submission id; it is NOT single-use, and every
 * load re-reads the submission's current photo state. The upload API itself is unchanged.
 */
// noIndex: token-gated, not public content, and excluded from the sitemap.
export const metadata: Metadata = buildPageMetadata({
  title: 'Vendor Product Photos — National Show',
  description: 'Upload the product photos for your 2027 SAOC National Show vendor registration.',
  path: '/national-show/vendors/photos',
  noIndex: true,
});

// Reads Firestore at request time -- must never be prerendered at build time.
export const dynamic = 'force-dynamic';

interface VendorPhotosPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

async function loadSubmission(vendorSubmissionId: string): Promise<Record<string, unknown> | null> {
  const db = getFirestore(initAdmin());
  const snapshot = await db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(vendorSubmissionId).get();
  return snapshot.exists ? (snapshot.data() ?? null) : null;
}

export default async function VendorPhotosPage({ searchParams }: VendorPhotosPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = typeof resolvedSearchParams.token === 'string' ? resolvedSearchParams.token : '';

  const secret = process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[vendors/photos/page] VENDOR_STAND_PAYMENT_TOKEN_SECRET is unset; refusing all photo-resume sessions.',
    );
  }

  const state = await resolveVendorPhotoResumeState({
    token,
    secret,
    now: new Date(),
    loadSubmission,
  });

  return (
    <>
      <NosHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        title="Vendor Product Photos"
        lede="Upload the product photos for your 2027 SAOC National Show vendor registration."
        priority
      />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
        {state.kind === 'invalid' && (
          <p className="font-sans text-[15px] text-ink">
            This photo upload link is no longer valid. Please contact SAOC if you believe this is an
            error.
          </p>
        )}
        {state.kind === 'complete' && (
          <p role="status" className="font-sans text-[15px] text-ink">
            All 3 required product photos have been uploaded.
          </p>
        )}
        {state.kind === 'upload' && (
          <VendorPhotoResumeUploads
            submissionId={state.vendorSubmissionId}
            missingSlots={state.missingSlots}
            serverUploadedCount={state.uploadedCount}
          />
        )}
      </div>
    </>
  );
}
