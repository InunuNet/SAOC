import { redirect } from 'next/navigation';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

/**
 * Server-side gate for the /admin/vendors subtree only (mission vendor-registration F6) --
 * mirrors app/admin/door/layout.tsx's subtree-scoping rationale exactly: a layout at the
 * /admin root would also wrap /admin/login and /admin/door, neither of which should inherit
 * this capability gate. A signed-in admin without 'review-vendor-applications' is redirected
 * to /admin (the plain ticket dashboard), not shown a raw 403 page. See
 * contracts/golden/vendor-f6-review-workflow/README.md.
 */
export default async function VendorsAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  if (!hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'review-vendor-applications', { now, lookupShowWindow })) {
    redirect('/admin');
  }

  return children;
}
