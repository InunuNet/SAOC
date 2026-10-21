import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { VENDOR_STAND_ORDERS_COLLECTION } from '@/lib/vendor-stand-orders';
import { serializeVendorSubmission } from '@/lib/firestore-serialization';
import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { VendorReviewTable } from '@/components/admin/VendorReviewTable';
import type { VendorSubmission, VendorStandOrderStatus } from '@/types/index';

/**
 * /admin/vendors — vendor application review listing (mission vendor-registration F6).
 * Sits inside app/admin/(shell)/vendors/layout.tsx's capability gate; this file is a UI-only
 * listing + approve/reject surface, not itself contract-tested (see
 * contracts/golden/vendor-f6-review-workflow/README.md's "What this contract does NOT
 * prove"). Reads vendorSubmissions directly via the Admin SDK, mirroring the tickets page's
 * fetchTickets() rather than round-tripping through its own GET /api/admin/vendors.
 */
// This page never reads cookies/headers itself (the admin-session check lives in
// app/admin/(shell)/vendors/layout.tsx), so Next has no signal to treat it as dynamic and will
// prerender it at build time -- calling initAdmin() during a cloud build then throws
// ("Missing Firebase Admin credentials"), because FIREBASE_ADMIN_* are runtime-only secrets
// there. Firestore must only be read at request time, never during the build.
export const dynamic = 'force-dynamic';

export default async function VendorsAdminPage() {
  const [submissions, standPaymentStatusById] = await Promise.all([
    fetchVendorSubmissions(),
    fetchStandPaymentStatusById(),
  ]);

  return (
    <PageShell>
      <PageHeader title="Vendors" />
      <VendorReviewTable submissions={submissions} standPaymentStatusById={standPaymentStatusById} />
    </PageShell>
  );
}

// Newest first, ordered by Firestore; the table never re-sorts.
async function fetchVendorSubmissions(): Promise<VendorSubmission[]> {
  const db = getFirestore(initAdmin());
  const snapshot = await db
    .collection(VENDOR_SUBMISSIONS_COLLECTION)
    .orderBy('submittedAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => serializeVendorSubmission(doc.id, doc.data()));
}

/**
 * F32 (vendor-gated-registration-flow, M3) — READ-ONLY. Keyed by vendorSubmissionId (the
 * vendorStandOrders doc id, by construction — see lib/vendor-stand-orders.ts). A submission
 * absent from this map has "not started" -- no stand order has ever been created for it. This
 * page never writes to vendorStandOrders; only lib/vendor-stand-payment-notification.ts (F31's
 * settlement handler) may set its `status` to 'paid'.
 */
async function fetchStandPaymentStatusById(): Promise<Record<string, VendorStandOrderStatus>> {
  const db = getFirestore(initAdmin());
  const snapshot = await db.collection(VENDOR_STAND_ORDERS_COLLECTION).get();

  const statusById: Record<string, VendorStandOrderStatus> = {};
  for (const doc of snapshot.docs) {
    statusById[doc.id] = doc.data().status as VendorStandOrderStatus;
  }
  return statusById;
}
