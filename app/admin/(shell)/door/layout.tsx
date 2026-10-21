import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/admin-auth';

/**
 * Server-side gate for the /admin/door subtree only — never the /admin root, which
 * would also wrap /admin/login and either infinite-redirect or need a pathname
 * exception. See contracts/golden/admin-auth-hardening/door-gate.golden.md.
 */
export default async function DoorLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }
  return children;
}
