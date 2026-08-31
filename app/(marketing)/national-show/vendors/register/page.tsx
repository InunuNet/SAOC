import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { PageHero } from '@/components/ui/PageHero';
import { VendorRegisterForm, VendorRegistrationCodeEntryForm } from '@/components/vendors';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import { verifyVendorRegistrationToken } from '@/lib/vendor-registration-token';
import { VENDOR_REGISTRATION_SESSION_COOKIE_NAME } from '@/lib/vendor-registration-code-verify-handler';

/**
 * F23 (vendor-gated-registration-flow, M4) -- REWRITTEN from the M1/F7 `?token=` gate. The
 * full registration form is still deliberately NOT linked from any public nav/page (F8), and
 * still reachable only through the vendor-gated flow -- but the gate itself is now the
 * internal, HttpOnly-cookie-delivered session artifact minted by
 * POST /api/vendors/register/verify-code, not a public-facing search-param token. See
 * contracts/golden/vendor-gated-registration-flow-m4/README.md's "Migration" for why this is a
 * page-level swap of what gets checked, not a rewrite of F3's HMAC module (repointed, not
 * rewritten) or F7's already-proven single-use claim (reused as-is by
 * app/api/vendors/register/route.ts).
 *
 * Server component: reads the session cookie, verifies it (F3's verifyVendorRegistrationToken),
 * THEN looks up the linked VendorApplication and checks status === 'approved' and
 * registrationTokenConsumedAt is unset -- renders VendorRegisterForm ONLY on that exact success
 * path. Every other outcome -- no cookie, malformed, bad signature, expired, application not
 * found, wrong status, already consumed -- renders the two-field code-entry form instead. Fails
 * closed: the default branch is the gate, not access.
 *
 * `?name=&code=` search params (carried by the approval email's convenience link) only
 * PREFILL the code-entry form's two inputs -- the vendor still must submit through the
 * rate-limited verify-code endpoint; the link is never itself a bypass.
 */
export const metadata: Metadata = { title: 'Vendor Registration — National Show' };

// This page reads a cookie and calls Firestore at request time -- must never be prerendered at
// build time (FIREBASE_ADMIN_* secrets are runtime-only), mirroring app/admin/vendors/page.tsx's
// own `dynamic = 'force-dynamic'` rationale.
export const dynamic = 'force-dynamic';

interface VendorRegisterPageProps {
  searchParams: Promise<{ name?: string | string[]; code?: string | string[] }>;
}

export default async function VendorRegisterPage({ searchParams }: VendorRegisterPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialBusinessName =
    typeof resolvedSearchParams.name === 'string' ? resolvedSearchParams.name : '';
  const initialCodeId = typeof resolvedSearchParams.code === 'string' ? resolvedSearchParams.code : '';

  const usable = await isVendorRegistrationSessionUsable();

  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        heading="Vendor Registration"
        lede="Register your business as a vendor at the 2027 SAOC National Show."
      />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
        {usable ? (
          <VendorRegisterForm />
        ) : (
          <VendorRegistrationCodeEntryForm
            initialBusinessName={initialBusinessName}
            initialCodeId={initialCodeId}
          />
        )}
      </div>
    </>
  );
}

/**
 * Read-only gate check -- does NOT consume anything (a vendor must be able to reload the form
 * mid-fill without being locked out). Single-use consumption still happens once, atomically,
 * inside the POST /api/vendors/register handler on a successful write (F7, unchanged). Returns
 * false on ANY failure mode so the page always falls back to the same code-entry form, never a
 * distinguishing outcome.
 */
async function isVendorRegistrationSessionUsable(): Promise<boolean> {
  const secret = process.env.VENDOR_REGISTRATION_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[vendors/register/page] VENDOR_REGISTRATION_TOKEN_SECRET is unset; refusing all registration sessions.',
    );
    return false;
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(VENDOR_REGISTRATION_SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return false;
  }

  const verification = verifyVendorRegistrationToken({ token: sessionToken, secret, now: new Date() });
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

  // The session must still name the CURRENT registration-code generation. A reissue bumps it,
  // so a session minted from a superseded code falls back to the code-entry form here, exactly
  // as POST /api/vendors/register refuses it inside its claim transaction. A session with no
  // generation at all predates generation binding and is refused too -- fail closed.
  if (verification.generation === null) {
    return false;
  }
  const data = snapshot.data();
  const currentGeneration =
    typeof data?.registrationCodeGeneration === 'number' &&
    Number.isFinite(data.registrationCodeGeneration)
      ? (data.registrationCodeGeneration as number)
      : 0;
  if (currentGeneration !== verification.generation) {
    return false;
  }

  return data?.status === 'approved' && !data?.registrationTokenConsumedAt;
}
