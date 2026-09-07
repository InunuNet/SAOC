import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/admin-auth';

/**
 * Server-side gate for the /admin/exhibitors subtree only (F14, nos-design-system M5) —
 * mirrors app/admin/visitors/layout.tsx and app/admin/door/layout.tsx's subtree-scoping
 * rationale. No capability is required — an ok admin session is the only requirement.
 */
export default async function ExhibitorsAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }
  return children;
}
