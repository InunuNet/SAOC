import type { Metadata } from 'next';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { NosHero } from '@/components/nos/NosHero';
import { VendorStandPaymentForm } from '@/components/vendors/VendorStandPaymentForm';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { VENDOR_STAND_ORDERS_COLLECTION } from '@/lib/vendor-stand-orders';
import {
  PENDING_NOTICE_BODY,
  PENDING_NOTICE_HEADING,
  isPendingPaymentHoldActive,
} from '@/lib/payments/pending-hold';
import { verifyVendorStandPaymentToken } from '@/lib/vendor-stand-payment-token';
import { buildPageMetadata } from '@/lib/seo';
import { withTicketingTestTitle } from '@/lib/ticketing-test-metadata';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';
import { saocUrl } from '@/lib/site-hosts';

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
// noIndex: token-gated, not public content, and excluded from the sitemap. No Event or Offer
// markup here either — the stand fee is a gated B2B transaction, not a public ticket sale
// (M6/B8c).
export const metadata: Metadata = withTicketingTestTitle(
  buildPageMetadata({
    title: 'Vendor stand payment',
    image: nosOgImage('Vendor stand payment — National Show'),
    description: 'Select your stand size and complete payment for the 2027 National Orchid Show.',
    path: '/national-show/vendors/payment',
    noIndex: true,
  })
);

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
  /** F31 -- the gateway reported Pending for the current attempt; payment may still complete. */
  awaitingConfirmation: boolean;
}

export default async function VendorStandPaymentPage({
  searchParams,
}: VendorStandPaymentPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = typeof resolvedSearchParams.token === 'string' ? resolvedSearchParams.token : '';

  const { usable, businessName, awaitingConfirmation } = await resolveUsability(token);

  return (
    <>
      {/* F11 (nos-design-system, M3): restraint scales with transaction risk — someone
          entering card details should feel the page is boring and safe, so this stays the
          same conventional hero treatment as the rest of the site, nothing more decorative.
          VendorStandPaymentForm is SAOC-owned and untouched. */}
      <NosHero
        route="/national-show/vendors/payment"
        title="Vendor stand payment"
        lede="Select your stand size and complete payment for the 2027 National Orchid Show."
        priority
      />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
        {usable && awaitingConfirmation ? (
          <div role="status" aria-live="polite">
            <h2 className="font-sans text-[15px] font-semibold text-ink">
              {PENDING_NOTICE_HEADING}
            </h2>
            <p className="mt-2 font-sans text-[15px] text-ink">{PENDING_NOTICE_BODY}</p>
          </div>
        ) : usable ? (
          <VendorStandPaymentForm token={token} businessName={businessName} />
        ) : (
          <p className="font-sans text-[15px] text-ink">
            This payment link is no longer valid. Please{' '}
            <a href={saocUrl('/contact')} className="text-ink underline underline-offset-2">
              contact SAOC
            </a>{' '}
            if you believe this is an error.
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
  const fallback: UsabilityResult = {
    usable: false,
    businessName: '',
    awaitingConfirmation: false,
  };
  if (!token) return fallback;

  const secret = process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[vendors/payment/page] VENDOR_STAND_PAYMENT_TOKEN_SECRET is unset; refusing all stand-payment sessions.'
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
  const standOrder = standOrderSnapshot.data();
  if (standOrderSnapshot.exists && standOrder?.status === 'paid') return fallback;

  return {
    usable: true,
    businessName: (data?.businessName as string | undefined) ?? '',
    awaitingConfirmation:
      standOrder?.status === 'pending' && isPendingPaymentHoldActive(standOrder.gatewayPending),
  };
}
