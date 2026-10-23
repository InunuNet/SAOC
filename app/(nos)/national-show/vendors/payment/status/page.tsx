import type { Metadata } from 'next';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { NosHero } from '@/components/nos/NosHero';
import { VENDOR_STAND_ORDERS_COLLECTION } from '@/lib/vendor-stand-orders';
import {
  resolveVendorStandReturnState,
  type VendorStandReturnState,
} from '@/lib/vendor-stand-return';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

/**
 * Gateway return page for vendor stand payments. Success, cancel and error all land here with
 * only `?a=<attemptId>`. It mints and verifies no token, reads no submission, PII or amount,
 * writes nothing and never redirects: the outcome comes solely from the stored order's status.
 */
export const metadata: Metadata = buildPageMetadata({
  title: 'Vendor stand payment',
  image: nosOgImage('Vendor stand payment — National Show'),
  description: 'Payment status for your 2027 National Orchid Show vendor stand.',
  path: '/national-show/vendors/payment/status',
  noIndex: true,
});

// Reads Firestore per request; must never be prerendered or cached.
export const dynamic = 'force-dynamic';

interface VendorStandPaymentStatusPageProps {
  searchParams: Promise<{ a?: string | string[] }>;
}

const COPY: Record<VendorStandReturnState, { heading: string; body: string }> = {
  paid: {
    heading: 'Stand Payment Confirmed',
    body: 'Your stand payment for the National Orchid Show has been received.',
  },
  pending: {
    heading: 'Payment Not Yet Confirmed',
    body: 'Your payment has not been confirmed yet. This can take a few minutes. Please check again shortly.',
  },
  'not-completed': {
    heading: 'Payment Not Completed',
    body: 'Your payment was not completed. Use the payment link in your email to try again.',
  },
};

export default async function VendorStandPaymentStatusPage({
  searchParams,
}: VendorStandPaymentStatusPageProps) {
  const resolvedSearchParams = await searchParams;
  const attemptId = resolvedSearchParams.a;

  const state = await resolveVendorStandReturnState({
    attemptId,
    loadOrderStatus: loadStandOrderStatus,
  });
  const copy = COPY[state];

  return (
    <>
      <NosHero
        route="/national-show/vendors/payment/status"
        title="Vendor stand payment"
        lede="Payment status for your 2027 National Orchid Show vendor stand."
        priority
      />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
        <h2 className="font-serif text-[20px] font-normal text-ink">{copy.heading}</h2>
        <p className="mt-4 font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-ink">{copy.body}</p>
        <p className="mt-4 font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-ink">
          Please contact SAOC if you believe this is an error.
        </p>
      </div>
    </>
  );
}

/**
 * Single-field equality plus limit(1): served by Firestore's automatic single-field index, so no
 * composite index is needed. Returns only the status string. On failure logs the attempt id
 * alone and rethrows so the resolver maps it to the neutral pending state.
 */
async function loadStandOrderStatus(attemptId: string): Promise<string | null> {
  try {
    const db = getFirestore(initAdmin());
    const snapshot = await db
      .collection(VENDOR_STAND_ORDERS_COLLECTION)
      .where('attemptId', '==', attemptId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const status: unknown = snapshot.docs[0].data().status;
    return typeof status === 'string' ? status : null;
  } catch (error) {
    console.error('[vendors/payment/status] Order lookup failed.', { attemptId, error });
    throw error;
  }
}
