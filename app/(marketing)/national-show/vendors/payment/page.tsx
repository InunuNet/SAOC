import type { Metadata } from 'next';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { PageHero } from '@/components/ui/PageHero';
import { VendorStandPaymentForm } from '@/components/vendors/VendorStandPaymentForm';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { VENDOR_STAND_ORDERS_COLLECTION } from '@/lib/vendor-stand-orders';
import { verifyVendorStandPaymentToken } from '@/lib/vendor-stand-payment-token';

/**
 * Public stand-payment page (mission vendor-gated-registration-flow, M3/F29). Token-gated via
 * a `?token=` search param -- mirrors M1's ORIGINAL register-page posture (a public-facing
 * token, unlike M4's internal cookie session), since F27's token is deliberately NOT single-use
 * and must survive a vendor reloading this exact link days later. See
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "Token mechanism".
 *
 * This is a client-side UX check ONLY -- never authorizing by itself. Every money-moving
 * decision is re-verified server-side again by POST /api/vendors/stand-payment/initiate, which
 * re-reads the submission's CURRENT status rather than trusting this page's read.
 */
export const metadata: Metadata = { title: 'Vendor Stand Payment — National Show' };

// Reads Firestore at request time -- must never be prerendered at build time (FIREBASE_ADMIN_*
// secrets are runtime-only), same rationale as the gated vendor registration page's own
// `dynamic = 'force-dynamic'`.
export const dynamic = 'force-dynamic';

interface VendorStandPaymentPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

interface UsabilityResult {
  usable: boolean;
  businessName: string;
}

export default async function VendorStandPaymentPage({ searchParams }: VendorStandPaymentPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = typeof resolvedSearchParams.token === 'string' ? resolvedSearchParams.token : '';

  const { usable, businessName } = await resolveUsability(token);

  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        heading="Vendor Stand Payment"
        lede="Select your stand size and complete payment for the 2027 SAOC National Show."
      />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
        {usable ? (
          <VendorStandPaymentForm token={token} businessName={businessName} />
        ) : (
          <p className="font-sans text-[15px] text-ink">
            This payment link is no longer valid. Please contact SAOC if you believe this is an
            error.
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Read-only gate check -- does NOT consume anything, since F27's token is not single-use.
 * Returns `usable: false` on ANY failure mode (missing/malformed/expired token, submission not
 * found, not approved, or its stand order already 'paid') so the page always falls back to the
 * same generic message, never a distinguishing outcome -- same enumeration-blindness posture as
 * the register page's own gate check.
 */
async function resolveUsability(token: string): Promise<UsabilityResult> {
  const fallback: UsabilityResult = { usable: false, businessName: '' };
  if (!token) return fallback;

  const secret = process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[vendors/payment/page] VENDOR_STAND_PAYMENT_TOKEN_SECRET is unset; refusing all stand-payment sessions.',
    );
    return fallback;
  }

  const verification = verifyVendorStandPaymentToken({ token, secret, now: new Date() });
  if (!verification.ok) return fallback;

  const db = getFirestore(initAdmin());
  const submissionSnapshot = await db
    .collection(VENDOR_SUBMISSIONS_COLLECTION)
    .doc(verification.vendorSubmissionId)
    .get();
  if (!submissionSnapshot.exists) return fallback;

  const data = submissionSnapshot.data();
  if (data?.status !== 'approved') return fallback;

  const standOrderSnapshot = await db
    .collection(VENDOR_STAND_ORDERS_COLLECTION)
    .doc(verification.vendorSubmissionId)
    .get();
  if (standOrderSnapshot.exists && standOrderSnapshot.data()?.status === 'paid') return fallback;

  return { usable: true, businessName: (data?.businessName as string | undefined) ?? '' };
}
