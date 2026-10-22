import { getFirestore } from 'firebase-admin/firestore';

import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { VendorApplicationReviewTable } from '@/components/admin/VendorApplicationReviewTable';
import { initAdmin } from '@/lib/firebase-admin';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import { serializeVendorApplication } from '@/lib/firestore-serialization';
import type { VendorApplication } from '@/types/index';

// /admin/vendors/applications -- vendor application review listing (mission
// vendor-gated-registration-flow F5). Sits inside app/admin/(shell)/vendors/layout.tsx's
// capability gate, which already covers this path prefix. Reads vendorApplications directly
// via the Admin SDK, UI-only, not itself contract-tested (see
// contracts/golden/vendor-gated-registration-flow-f1/README.md). Never prerendered:
// Firestore must only be read at request time.
export const dynamic = 'force-dynamic';

export default async function VendorApplicationsAdminPage() {
  const applications = await fetchVendorApplications();

  return (
    <PageShell>
      <PageHeader title="Applications" />
      <VendorApplicationReviewTable applications={applications} />
    </PageShell>
  );
}

// Newest first, ordered by Firestore. An unordered .get() returns auto-ID order, which buried a
// real application; the table trusts this order and never re-sorts.
async function fetchVendorApplications(): Promise<VendorApplication[]> {
  const db = getFirestore(initAdmin());
  const snapshot = await db
    .collection(VENDOR_APPLICATIONS_COLLECTION)
    .orderBy('submittedAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => serializeVendorApplication(doc.id, doc.data()));
}
