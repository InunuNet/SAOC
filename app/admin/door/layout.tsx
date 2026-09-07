import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/admin-auth';

/**
 * Server-side gate for the /admin/door subtree only — never the /admin root, which
 * would also wrap /admin/login and either infinite-redirect or need a pathname
 * exception. See contracts/golden/admin-auth-hardening/door-gate.golden.md.
 *
 * F14 (nos-design-system M5) — deliberately UNTOUCHED by the M5 restyling. This subtree
 * renders no chrome and no persistent AdminNav bar of its own; app/admin/door/page.tsx keeps
 * calling <AdminNav variant="minimal" .../> exactly as before, so the one-handed camera
 * scanning layout keeps its full-height video container and near-zero fixed nav footprint.
 */
export default async function DoorLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }
  return children;
}
