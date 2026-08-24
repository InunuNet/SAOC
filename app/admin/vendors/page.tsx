import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { VendorReviewTable } from '@/components/admin/VendorReviewTable';
import { AdminNav } from '@/components/admin/AdminNav';
import type { ShowIdentity } from '@/types';
import type { VendorSubmission } from '@/types/index';

/**
 * /admin/vendors — vendor application review listing (mission vendor-registration F6).
 * Sits inside app/admin/vendors/layout.tsx's capability gate; this file is a UI-only
 * listing + approve/reject surface, not itself contract-tested (see
 * contracts/golden/vendor-f6-review-workflow/README.md's "What this contract does NOT
 * prove"). Reads vendorSubmissions directly via the Admin SDK, mirroring app/admin/page.tsx's
 * fetchTickets() rather than round-tripping through its own GET /api/admin/vendors.
 */
// This page never reads cookies/headers itself (the admin-session check lives in
// app/admin/vendors/layout.tsx), so Next has no signal to treat it as dynamic and will
// prerender it at build time -- calling initAdmin() during a cloud build then throws
// ("Missing Firebase Admin credentials"), because FIREBASE_ADMIN_* are runtime-only secrets
// there. Firestore must only be read at request time, never during the build.
export const dynamic = 'force-dynamic';

export default async function VendorsAdminPage() {
  // Re-derives canReviewVendors independently of app/admin/vendors/layout.tsx's own gate
  // (which already proved it true to reach this page at all) — a few extra lines,
  // deliberately not a hardcoded `true` literal, so AdminNav stays correct if the
  // vendors capability criteria ever change without anyone remembering to update a
  // hardcoded prop (see this feature's golden).
  const session = await getAdminSession();
  let canReviewVendors = false;
  let canManagePaymentSettings = false;
  if (session.ok) {
    const now = new Date();
    const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
    canReviewVendors = hasCapability(
      session.decodedToken,
      NATIONAL_SHOW_ID,
      'review-vendor-applications',
      { now, lookupShowWindow },
    );
    canManagePaymentSettings = hasCapability(
      session.decodedToken,
      NATIONAL_SHOW_ID,
      'manage-payment-settings',
      { now, lookupShowWindow },
    );
  }

  const [show, submissions] = await Promise.all([
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    fetchVendorSubmissions(),
  ]);

  return (
    <>
      <UtilityBar show={show} />
      <Header />
      <AdminNav
        variant="bar"
        canReviewVendors={canReviewVendors}
        canManagePaymentSettings={canManagePaymentSettings}
      />
      <main>
        <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8 sm:py-16">
          <span className="eyebrow">Admin</span>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">
              Vendor Applications
            </h1>
          </div>

          <div className="mt-8">
            <VendorReviewTable submissions={submissions} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function fetchVendorSubmissions(): Promise<VendorSubmission[]> {
  const db = getFirestore(initAdmin());
  const snapshot = await db.collection(VENDOR_SUBMISSIONS_COLLECTION).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    // Firestore's untyped document data (submittedAt/reviewedAt arrive as Timestamps, not
    // Date) is trusted here rather than field-by-field validated — this listing page is
    // UI-only and not itself contract-tested (see this feature's golden README).
    return { id: doc.id, ...data } as VendorSubmission;
  });
}
