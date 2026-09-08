import { redirect } from 'next/navigation';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { AdminNav } from '@/components/admin/AdminNav';
import type { ShowIdentity } from '@/types';

// This subtree never otherwise rendered site chrome (mission admin-settings-deploy-and-chrome-fix
// F1) -- app/admin/page.tsx and app/admin/vendors/page.tsx both wrap themselves in
// UtilityBar/Header/AdminNav/Footer directly, but /admin/settings/page.tsx is a 'use client'
// toggle component that cannot itself call sanityFetch/hasCapability. This layout already has
// `session` and `lookupShowWindow` in scope from its existing capability gate, so it is the
// lower-risk place to grow the chrome around {children} rather than restructuring page.tsx.
export const dynamic = 'force-dynamic';

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
  const canManagePaymentSettings = hasCapability(
    session.decodedToken,
    NATIONAL_SHOW_ID,
    'manage-payment-settings',
    { now, lookupShowWindow },
  );
  if (!canManagePaymentSettings) {
    redirect('/admin');
  }
  const canReviewVendors = hasCapability(
    session.decodedToken,
    NATIONAL_SHOW_ID,
    'review-vendor-applications',
    { now, lookupShowWindow },
  );

  const show = await sanityFetch<ShowIdentity>({
    query: nationalShowQuery,
    tags: ['nationalShow', 'sanity'],
  });

  return (
    <>
      <UtilityBar show={show} />
      <Header />
      <AdminNav
        variant="bar"
        canReviewVendors={canReviewVendors}
        canManagePaymentSettings={canManagePaymentSettings}
      />
      {children}
      <Footer />
    </>
  );
}
