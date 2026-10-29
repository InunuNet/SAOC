import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { VENDOR_STAND_ORDERS_COLLECTION } from '@/lib/vendor-stand-orders';
import { serializeVendorApplication, serializeVendorSubmission } from '@/lib/firestore-serialization';
import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { VendorSubmissionDetail } from '@/components/admin/VendorSubmissionDetail';
import { BUTTON_SECONDARY } from '@/components/admin/tokens';
import type { VendorApplication, VendorStandOrderStatus, VendorSubmission } from '@/types/index';

/**
 * /admin/vendors/[id] -- read-only view of one full vendor registration. The subtree layout
 * already gates /admin/vendors, but this page holds full PII (addresses, vehicle plates,
 * insurance policy numbers) and a Next layout is not re-run on every client navigation, so the
 * same session and capability check is repeated here. This page performs no Firestore writes.
 */
export const dynamic = 'force-dynamic';

const STAND_ORDER_STATUSES: readonly VendorStandOrderStatus[] = ['pending', 'paid', 'failed', 'cancelled'];

function normalise(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export default async function VendorSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  if (!hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'review-vendor-applications', { now, lookupShowWindow })) {
    redirect('/admin');
  }

  const { id } = await params;
  const db = getFirestore(initAdmin());

  const snapshot = await db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(id).get();
  if (!snapshot.exists) {
    notFound();
  }
  const submission = serializeVendorSubmission(snapshot.id, snapshot.data() ?? {});

  const standOrderSnapshot = await db.collection(VENDOR_STAND_ORDERS_COLLECTION).doc(id).get();
  const rawStandStatus = standOrderSnapshot.exists ? standOrderSnapshot.data()?.status : null;
  const standOrderStatus =
    STAND_ORDER_STATUSES.find((status) => status === rawStandStatus) ?? null;

  const application = await findMatchingApplication(db, submission);

  return (
    <PageShell>
      <PageHeader
        title={submission.businessName}
        subtitle={submission.contactEmail}
        actions={
          <Link href="/admin/vendors" className={BUTTON_SECONDARY}>
            Back to vendors
          </Link>
        }
      />
      <VendorSubmissionDetail
        submission={submission}
        standOrderStatus={standOrderStatus}
        application={application}
      />
    </PageShell>
  );
}

/**
 * Submissions store no application id, so the link is best-effort: same contact email and the
 * same normalised business name. Only exactly one match counts; zero or several return null.
 */
async function findMatchingApplication(
  db: Firestore,
  submission: VendorSubmission,
): Promise<VendorApplication | null> {
  const normalisedName = normalise(submission.businessName);
  if (typeof submission.contactEmail !== 'string' || submission.contactEmail.trim() === '' || normalisedName === '') {
    return null;
  }
  const snapshot = await db
    .collection(VENDOR_APPLICATIONS_COLLECTION)
    .where('contactEmail', '==', submission.contactEmail)
    .get();

  const matches = snapshot.docs
    .map((doc) => serializeVendorApplication(doc.id, doc.data()))
    .filter((application) => normalise(application.businessName) === normalisedName);

  return matches.length === 1 ? matches[0] : null;
}
