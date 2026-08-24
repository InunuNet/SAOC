import { redirect } from 'next/navigation';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

/**
 * Server-side gate for the /admin/settings subtree (mission ozow-sandbox-toggle F1) --
 * mirrors app/admin/vendors/layout.tsx exactly. A signed-in admin without
 * 'manage-payment-settings' is redirected to /admin, not shown a raw 403 page.
 */
export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  if (!hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'manage-payment-settings', { now, lookupShowWindow })) {
    redirect('/admin');
  }

  return children;
}
