import { redirect } from 'next/navigation';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

// The capability gate lives here, and the sidebar shell around it comes from
// app/admin/(shell)/layout.tsx.
export const dynamic = 'force-dynamic';

/**
 * Server-side gate for the /admin/payments subtree. Moved from /admin/settings by mission
 * payment-gateway-settings (it began as the ozow-sandbox-toggle F1 gate) -- mirrors
 * app/admin/vendors/layout.tsx exactly. A signed-in admin without 'manage-payment-settings' is
 * redirected to /admin, not shown a raw 403 page. The UI hiding the nav item is not the control;
 * this layout and the API routes are.
 */
export default async function AdminPaymentsLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  const canManagePaymentSettings = hasCapability(
    session.decodedToken,
    NATIONAL_SHOW_ID,
    'manage-payment-settings',
    { now, lookupShowWindow },
  );
  if (!canManagePaymentSettings) {
    redirect('/admin');
  }
  return children;
}
