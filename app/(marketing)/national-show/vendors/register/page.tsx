import type { Metadata } from 'next';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { PageHero } from '@/components/ui/PageHero';
import { VendorRegisterForm } from '@/components/vendors';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import { verifyVendorRegistrationToken } from '@/lib/vendor-registration-token';

/**
 * F7 (vendor-gated-registration-flow) -- the full registration form is deliberately NOT
 * linked from any public nav/page (F8 repoints the showcase page to /vendors/apply instead).
 * It is reachable ONLY via a valid `?token=` search param from the emailed single-use link
 * (F5/F6). Server component: verifies the token's signature + expiry (F3), THEN looks up the
 * linked VendorApplication and checks status === 'approved' and registrationTokenConsumedAt is
 * unset, and renders VendorRegisterForm ONLY on that exact success path. Every other outcome
 * -- missing token, malformed, bad signature, expired, application not found, wrong status,
 * already consumed -- renders one generic message, never the form and never a distinguishing
 * error. Fails closed: the default branch is refusal, not access. See
 * contracts/golden/vendor-gated-registration-flow-f1/README.md.
 *
 * POST /api/vendors/register (app/api/vendors/register/route.ts) additionally requires and
 * re-verifies this same token server-side -- this page-level check is a UX convenience, never
 * the sole gate.
 */
export const metadata: Metadata = { title: 'Vendor Registration — National Show' };

// This page reads a search param and calls Firestore at request time -- must never be
// prerendered at build time (FIREBASE_ADMIN_* secrets are runtime-only), mirroring
// app/admin/vendors/page.tsx's own `dynamic = 'force-dynamic'` rationale.
export const dynamic = 'force-dynamic';

const GENERIC_INVALID_LINK_MESSAGE = 'This registration link is invalid or has expired.';

interface VendorRegisterPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function VendorRegisterPage({ searchParams }: VendorRegisterPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = typeof resolvedSearchParams.token === 'string' ? resolvedSearchParams.token : undefined;

  const usable = token ? await isRegistrationLinkUsable(token) : false;

  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        heading="Vendor Registration"
        lede="Register your business as a vendor at the 2027 SAOC National Show."
      />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
        {usable && token ? (
          <VendorRegisterForm token={token} />
        ) : (
          <p role="alert" className="border border-rule bg-ivory px-6 py-8 font-sans text-[15px] text-ink">
            {GENERIC_INVALID_LINK_MESSAGE}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Read-only gate check -- does NOT consume the token (a vendor must be able to reload the
 * form mid-fill without being locked out). Consumption happens once, atomically, inside the
 * POST /api/vendors/register handler on a successful write (F7). Returns false on ANY failure
 * mode so the page always falls back to the same generic message, never a distinguishing one.
 */
async function isRegistrationLinkUsable(token: string): Promise<boolean> {
  const secret = process.env.VENDOR_REGISTRATION_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[vendors/register/page] VENDOR_REGISTRATION_TOKEN_SECRET is unset; refusing all registration links.',
    );
    return false;
  }

  const verification = verifyVendorRegistrationToken({ token, secret, now: new Date() });
  if (!verification.ok) {
    return false;
  }

  const db = getFirestore(initAdmin());
  const snapshot = await db
    .collection(VENDOR_APPLICATIONS_COLLECTION)
    .doc(verification.applicationId)
    .get();

  if (!snapshot.exists) {
    return false;
  }

  const data = snapshot.data();
  return data?.status === 'approved' && !data?.registrationTokenConsumedAt;
}
