import Link from 'next/link';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import { serializeVendorApplication } from '@/lib/firestore-serialization';
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { VendorApplicationReviewTable } from '@/components/admin/VendorApplicationReviewTable';
import { AdminNav } from '@/components/admin/AdminNav';
import type { ShowIdentity } from '@/types';
import type { VendorApplication } from '@/types/index';

/**
 * /admin/vendors/applications -- vendor application review listing (mission
 * vendor-gated-registration-flow F5). Sits inside app/admin/vendors/layout.tsx's capability
 * gate -- `/admin/vendors/applications` is already covered by that layout's path prefix, no
 * new layout needed. Mirrors app/admin/vendors/page.tsx's own structure: reads
 * vendorApplications directly via the Admin SDK, UI-only, not itself contract-tested (see
 * contracts/golden/vendor-gated-registration-flow-f1/README.md).
 */
export const dynamic = 'force-dynamic';

export default async function VendorApplicationsAdminPage() {
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

  const [show, applications] = await Promise.all([
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    fetchVendorApplications(),
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
            <Link
              href="/admin/vendors"
              className="font-sans text-[13px] font-medium text-ink underline hover:text-accent"
            >
              View full registrations →
            </Link>
          </div>

          <div className="mt-8">
            <VendorApplicationReviewTable applications={applications} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function fetchVendorApplications(): Promise<VendorApplication[]> {
  const db = getFirestore(initAdmin());
  const snapshot = await db.collection(VENDOR_APPLICATIONS_COLLECTION).get();

  return snapshot.docs.map((doc) => serializeVendorApplication(doc.id, doc.data()));
}
