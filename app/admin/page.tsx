import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { getAdminSession } from '@/lib/admin-auth';
import { resolveAdminNavCapabilities } from '@/lib/admin-nav-capabilities';
import { initAdmin } from '@/lib/firebase-admin';
import { findStrandedOrders } from '@/lib/reconciliation';
import { VENDOR_APPLICATIONS_COLLECTION } from '@/lib/vendor-applications';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { VENDOR_STAND_ORDERS_COLLECTION } from '@/lib/vendor-stand-orders';
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { AdminNav } from '@/components/admin/AdminNav';
import { StatusPill } from '@/components/admin/StatusPill';
import { PartyBadge } from '@/components/admin/PartyBadge';
import type { ShowIdentity } from '@/types';

/**
 * /admin (F14, nos-design-system M5) — the overview. A queue rack, NOT a data table (the
 * ticket table moved to /admin/visitors/tickets, F16). No import of the ticket-table
 * component is present in this file — see M5/A12.
 *
 * Layout follows goldens/m5-admin-ia.golden.md §3 exactly: show identity line, the queue
 * rack (one row per queue, ordered oldest-pending-age descending, zero-pending rows KEPT
 * visible), then section-at-a-glance cards. No charts, no revenue, no activity feed — none
 * of that data exists without fabricating it (see the golden's "Explicitly not on this
 * page").
 *
 * This dashboard gets the site's chrome directly (rather than via a shared app/admin/
 * layout.tsx) for the same reason as before this feature: a layout at that level would also
 * wrap /admin/door and /admin/login, both of which must NOT inherit it.
 */
export const dynamic = 'force-dynamic';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface QueueRow {
  id: string;
  name: string;
  pendingCount: number;
  oldestPendingAgeDays: number | null;
  actionLabel: string;
  actionHref: string;
}

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  const { canReviewVendors, canManagePaymentSettings } = await resolveAdminNavCapabilities(
    session.decodedToken,
  );

  const now = new Date();
  const [show, queueRows] = await Promise.all([
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    fetchQueueRows(now),
  ]);

  const showDaysUntil = computeDaysUntil(show?.showDate, now);

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
          <h1 className="mt-4 font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">
            Overview
          </h1>

          {/* Show identity line — every field Sanity does not supply renders a data-placeholder
              dash rather than an invented value. */}
          <p className="mt-2 font-sans text-[15px] text-muted" data-placeholder={show?.showDate ? undefined : 'show-identity'}>
            {show?.showDate ? (
              <>
                {show.hostRegion ?? 'National Show'} — {formatShowDateRange(show.showDate, show.showEndDate)}
                {showDaysUntil !== null ? ` · ${formatDaysUntil(showDaysUntil)}` : ''}
              </>
            ) : (
              'Show dates are not yet set in Sanity.'
            )}
          </p>

          <h2 className="mt-10 font-serif text-[20px] font-semibold text-ink">What needs you now</h2>
          <div className="mt-4 divide-y divide-rule border border-rule bg-ivory">
            {queueRows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="font-serif text-[32px] font-semibold leading-none text-ink tabular-nums">
                    {row.pendingCount}
                  </span>
                  <div>
                    <p className="font-sans text-[15px] font-medium text-ink">{row.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                      {row.oldestPendingAgeDays === null
                        ? 'no pending items'
                        : `oldest: ${formatAge(row.oldestPendingAgeDays)}`}
                    </p>
                  </div>
                  <StatusPill status={row.pendingCount === 0 ? 'done' : 'pending'} />
                </div>
                <Link
                  href={row.actionHref}
                  className="inline-block shrink-0 rounded-sm border border-rule bg-bone px-4 py-2 font-sans text-[13px] font-medium text-ink transition-colors hover:bg-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
                >
                  {row.actionLabel}
                </Link>
              </div>
            ))}
          </div>

          <h2 className="mt-10 font-serif text-[20px] font-semibold text-ink">Sections</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <SectionCard
              party="visitor"
              title="Visitors"
              description="Ticket orders and holders."
              href="/admin/visitors"
            />
            {canReviewVendors ? (
              <SectionCard
                party="vendor"
                title="Vendors"
                description="Applications, full registrations and stand payments."
                href="/admin/vendors"
              />
            ) : null}
            <SectionCard
              party="exhibitor"
              title="Exhibitors"
              description="Not yet accepted online — see the section for details."
              href="/admin/exhibitors"
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function SectionCard({
  party,
  title,
  description,
  href,
}: {
  party: 'visitor' | 'vendor' | 'exhibitor';
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block border border-rule bg-bone px-5 py-5 transition-colors hover:bg-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
    >
      <PartyBadge type={party} />
      <p className="mt-3 font-serif text-[17px] font-semibold text-ink">{title}</p>
      <p className="mt-1 font-sans text-[13px] text-muted">{description}</p>
    </Link>
  );
}

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function ageDaysFrom(oldest: Date | null, now: Date): number | null {
  if (!oldest) return null;
  return Math.max(0, Math.floor((now.getTime() - oldest.getTime()) / MS_PER_DAY));
}

function formatAge(days: number): string {
  if (days <= 0) return 'today';
  return days === 1 ? '1 day' : `${days} days`;
}

function formatDaysUntil(days: number): string {
  if (days < 0) return 'show has concluded';
  if (days === 0) return 'today';
  return days === 1 ? '1 day to go' : `${days} days to go`;
}

function computeDaysUntil(showDate: string | null | undefined, now: Date): number | null {
  if (!showDate) return null;
  const parsed = new Date(showDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((parsed.getTime() - now.getTime()) / MS_PER_DAY);
}

function formatShowDateRange(start: string, end: string | null | undefined): string {
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return start;
  const startLabel = startDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  if (!end) return startLabel;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return startLabel;
  const endLabel = endDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

/**
 * Fetches the four queues defined in goldens/m5-admin-ia.golden.md §3, then sorts by
 * oldest-pending-age DESCENDING (most-neglected first). A queue with zero pending items
 * sorts to the bottom (its `oldestPendingAgeDays` is `null`) rather than being hidden — a
 * disappearing row destroys the scan pattern.
 */
async function fetchQueueRows(now: Date): Promise<QueueRow[]> {
  const db = getFirestore(initAdmin());

  const [applicationsRow, submissionsRow, standPaymentsRow, ticketOrdersRow] = await Promise.all([
    fetchPendingVendorApplications(db, now),
    fetchAwaitingVendorSubmissions(db, now),
    fetchPendingStandPayments(db, now),
    fetchStrandedTicketOrders(now),
  ]);

  const rows = [applicationsRow, submissionsRow, standPaymentsRow, ticketOrdersRow];

  return rows.sort((a, b) => {
    if (a.oldestPendingAgeDays === null && b.oldestPendingAgeDays === null) return 0;
    if (a.oldestPendingAgeDays === null) return 1;
    if (b.oldestPendingAgeDays === null) return -1;
    return b.oldestPendingAgeDays - a.oldestPendingAgeDays;
  });
}

async function fetchPendingVendorApplications(
  db: FirebaseFirestore.Firestore,
  now: Date,
): Promise<QueueRow> {
  const snapshot = await db
    .collection(VENDOR_APPLICATIONS_COLLECTION)
    .where('status', '==', 'pending')
    .get();

  const oldest = snapshot.docs.reduce<Date | null>((earliest, doc) => {
    const submittedAt = toDateSafe(doc.data()['submittedAt']);
    if (!submittedAt) return earliest;
    if (!earliest || submittedAt < earliest) return submittedAt;
    return earliest;
  }, null);

  return {
    id: 'vendor-applications',
    name: 'Vendor applications',
    pendingCount: snapshot.size,
    oldestPendingAgeDays: ageDaysFrom(oldest, now),
    actionLabel: 'Review applications',
    actionHref: '/admin/vendors/applications',
  };
}

async function fetchAwaitingVendorSubmissions(
  db: FirebaseFirestore.Firestore,
  now: Date,
): Promise<QueueRow> {
  const snapshot = await db
    .collection(VENDOR_SUBMISSIONS_COLLECTION)
    .where('status', 'in', ['submitted', 'under-review'])
    .get();

  const oldest = snapshot.docs.reduce<Date | null>((earliest, doc) => {
    const submittedAt = toDateSafe(doc.data()['submittedAt']);
    if (!submittedAt) return earliest;
    if (!earliest || submittedAt < earliest) return submittedAt;
    return earliest;
  }, null);

  return {
    id: 'vendor-submissions',
    name: 'Vendor submissions',
    pendingCount: snapshot.size,
    oldestPendingAgeDays: ageDaysFrom(oldest, now),
    actionLabel: 'Review submissions',
    actionHref: '/admin/vendors',
  };
}

async function fetchPendingStandPayments(
  db: FirebaseFirestore.Firestore,
  now: Date,
): Promise<QueueRow> {
  const snapshot = await db
    .collection(VENDOR_STAND_ORDERS_COLLECTION)
    .where('status', '==', 'pending')
    .get();

  const oldest = snapshot.docs.reduce<Date | null>((earliest, doc) => {
    const createdAt = toDateSafe(doc.data()['createdAt']);
    if (!createdAt) return earliest;
    if (!earliest || createdAt < earliest) return createdAt;
    return earliest;
  }, null);

  return {
    id: 'vendor-payments',
    name: 'Vendor payments',
    pendingCount: snapshot.size,
    oldestPendingAgeDays: ageDaysFrom(oldest, now),
    actionLabel: 'Record payments',
    actionHref: '/admin/vendors',
  };
}

async function fetchStrandedTicketOrders(now: Date): Promise<QueueRow> {
  const stranded = await findStrandedOrders(Timestamp.fromDate(now));

  const oldestExpiry = stranded.reduce<Date | null>((earliest, order) => {
    const expiresAt = order.expiresAt ? order.expiresAt.toDate() : null;
    if (!expiresAt) return earliest;
    if (!earliest || expiresAt < earliest) return expiresAt;
    return earliest;
  }, null);

  return {
    id: 'ticket-orders',
    name: 'Ticket orders',
    pendingCount: stranded.length,
    oldestPendingAgeDays: ageDaysFrom(oldestExpiry, now),
    actionLabel: 'Reconcile orders',
    actionHref: '/admin/visitors/tickets',
  };
}
