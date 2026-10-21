import { redirect } from 'next/navigation';

import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import {
  DashboardPanel,
  NeedsAttentionList,
  PANEL_HEADING_CLASS,
  QuickActionList,
  StatCards,
} from '@/components/admin/dashboard/DashboardParts';
import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { fetchDashboardData } from '@/lib/admin-dashboard';
import { formatAdminClock } from '@/lib/admin-format';
import { isNewsletterAvailable } from '@/lib/admin-nav-config';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

// Counts are read at request time; the page is never prerendered (Firestore credentials are
// runtime-only secrets on the cloud build).
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  const canReviewVendors = hasCapability(
    session.decodedToken,
    NATIONAL_SHOW_ID,
    'review-vendor-applications',
    { now, lookupShowWindow },
  );
  const canManagePaymentSettings = hasCapability(
    session.decodedToken,
    NATIONAL_SHOW_ID,
    'manage-payment-settings',
    { now, lookupShowWindow },
  );

  const data = await fetchDashboardData();

  return (
    <PageShell>
      <PageHeader title="Dashboard" subtitle={`Updated ${formatAdminClock(data.generatedAt)}`} />
      <StatCards
        data={data}
        options={{ canReviewVendors, showNewsletter: isNewsletterAvailable() }}
      />
      <div className="mt-6 grid grid-cols-1 gap-4 min-[1280px]:grid-cols-2">
        <DashboardPanel>
          <h2 className={PANEL_HEADING_CLASS}>Quick actions</h2>
          <QuickActionList options={{ canReviewVendors, canManagePaymentSettings }} />
        </DashboardPanel>
        {canReviewVendors ? (
          <DashboardPanel>
            <h2 className={PANEL_HEADING_CLASS}>Needs attention</h2>
            <NeedsAttentionList items={data.needsAttention} />
          </DashboardPanel>
        ) : null}
      </div>
    </PageShell>
  );
}
