import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/admin-auth';

/**
 * Server-side gate for the /admin/visitors subtree only (F14, nos-design-system M5) — mirrors
 * app/admin/door/layout.tsx's subtree-scoping rationale: a layout at the /admin root would
 * also wrap /admin/login and /admin/door, neither of which should inherit it. No capability is
 * required here — an ok admin session is the only requirement, same as the old /admin ticket
 * table this section replaces (AdminNav's Visitors link is deliberately unconditional; see
 * components/admin/AdminNav.tsx's buildLinks comment).
 */
export default async function VisitorsAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }
  return children;
}
