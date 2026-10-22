import { redirect } from 'next/navigation';

import { AdminPill } from '@/components/admin/AdminPill';
import { AdminShell } from '@/components/admin/shell/AdminShell';
import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { fetchPendingApplicationCount } from '@/lib/admin-dashboard';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

// Every admin surface except /admin/login lives in this route group, so one layout supplies the
// sidebar shell. There is deliberately no app/admin/layout.tsx: it would also wrap /admin/login,
// which must keep its own public chrome. This layout redirects an unauthenticated visitor, and
// each subtree (door, vendors, settings) still runs its own gate. The capability booleans it
// resolves are presentation only: they decide which nav rows to show, never what is allowed.
export const dynamic = 'force-dynamic';

export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
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
    { now, lookupShowWindow }
  );
  const canManagePaymentSettings = hasCapability(
    session.decodedToken,
    NATIONAL_SHOW_ID,
    'manage-payment-settings',
    { now, lookupShowWindow }
  );
  const pendingCount = canReviewVendors ? await fetchPendingApplicationCount() : null;

  return (
    <>
      <AdminShell
        email={session.decodedToken.email ?? ''}
        canReviewVendors={canReviewVendors}
        canManagePaymentSettings={canManagePaymentSettings}
        pendingCount={pendingCount}
      >
        {children}
      </AdminShell>
      <AdminPill verifiedAdmin />
    </>
  );
}
