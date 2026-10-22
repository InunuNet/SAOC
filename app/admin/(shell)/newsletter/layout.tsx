import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/admin-auth';

/**
 * Server-side gate for the /admin/newsletter subtree: any allowlisted admin session, no
 * capability check (contract decision D3). Mirrors app/admin/vendors/layout.tsx's redirect.
 */
export default async function NewsletterAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  return children;
}
