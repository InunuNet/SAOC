// Server-only data for the admin dashboard and the sidebar pending badge. Counts use
// Firestore count() aggregations, never full-collection reads. A failed count degrades to
// null (the card shows an em dash, the badge hides) instead of taking the whole shell down.
import { getFirestore, type Query } from 'firebase-admin/firestore';

import { isNewsletterAvailable } from '@/lib/admin-nav-config';
import { initAdmin } from '@/lib/firebase-admin';
import { ORDERS_COLLECTION } from '@/lib/orders';
import { serializeVendorApplication } from '@/lib/firestore-serialization';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import type { OrderStatus, VendorApplication } from '@/types/index';

const TICKETS_COLLECTION = 'tickets';
const NEWSLETTER_SUBSCRIBERS_COLLECTION = 'newsletterSubscribers';
const NEEDS_ATTENTION_LIMIT = 5;

export interface PendingApplicationSummary {
  id: string;
  businessName: string;
  submittedAt: Date;
}

export interface DashboardData {
  ticketsSold: number | null;
  orders: number | null;
  pendingApplications: number | null;
  vendorsApproved: number | null;
  newsletterSubscribers: number | null;
  needsAttention: PendingApplicationSummary[];
  generatedAt: Date;
}

async function countOf(label: string, query: Query): Promise<number | null> {
  try {
    const snapshot = await query.count().get();
    return snapshot.data().count;
  } catch (error) {
    console.error('[admin-dashboard] count failed', {
      operation: label,
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return null;
  }
}

export async function fetchPendingApplicationCount(): Promise<number | null> {
  const db = getFirestore(initAdmin());
  return countOf(
    'pending-applications',
    db.collection(VENDOR_APPLICATIONS_COLLECTION).where('status', '==', 'pending'),
  );
}

/** The 5 oldest pending applications, ordered in memory: the pending set is small, and this
 *  avoids a (status, submittedAt) composite index. */
async function fetchNeedsAttention(): Promise<PendingApplicationSummary[]> {
  try {
    const db = getFirestore(initAdmin());
    const snapshot = await db
      .collection(VENDOR_APPLICATIONS_COLLECTION)
      .where('status', '==', 'pending')
      .get();
    return snapshot.docs
      .map((doc): VendorApplication => serializeVendorApplication(doc.id, doc.data()))
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
      .slice(0, NEEDS_ATTENTION_LIMIT)
      .map((app) => ({ id: app.id, businessName: app.businessName, submittedAt: app.submittedAt }));
  } catch (error) {
    console.error('[admin-dashboard] needs-attention query failed', {
      operation: 'needs-attention',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return [];
  }
}

export async function fetchDashboardData(ordersStatus: OrderStatus): Promise<DashboardData> {
  const db = getFirestore(initAdmin());
  const [ticketsSold, orders, pendingApplications, vendorsApproved, newsletterSubscribers, needsAttention] =
    await Promise.all([
      countOf(
        'tickets-sold',
        db.collection(TICKETS_COLLECTION).where('status', 'in', ['paid', 'checked-in']),
      ),
      countOf('orders', db.collection(ORDERS_COLLECTION).where('status', '==', ordersStatus)),
      fetchPendingApplicationCount(),
      countOf(
        'vendors-approved',
        db.collection(VENDOR_APPLICATIONS_COLLECTION).where('status', '==', 'approved'),
      ),
      isNewsletterAvailable()
        ? countOf(
            'newsletter-subscribers',
            db.collection(NEWSLETTER_SUBSCRIBERS_COLLECTION).where('status', '==', 'subscribed'),
          )
        : Promise.resolve(null),
      fetchNeedsAttention(),
    ]);

  return {
    ticketsSold,
    orders,
    pendingApplications,
    vendorsApproved,
    newsletterSubscribers,
    needsAttention,
    generatedAt: new Date(),
  };
}

export async function fetchCheckedInCount(): Promise<number | null> {
  const db = getFirestore(initAdmin());
  return countOf(
    'checked-in',
    db.collection(TICKETS_COLLECTION).where('status', '==', 'checked-in'),
  );
}
