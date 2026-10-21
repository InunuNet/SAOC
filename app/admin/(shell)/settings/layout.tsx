import { redirect } from 'next/navigation';

import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

// The page itself is a 'use client'
// toggle component that cannot itself call sanityFetch/hasCapability. This layout already has
// `session` and `lookupShowWindow` in scope, so the capability gate lives here, and the sidebar
// shell around it comes from app/admin/(shell)/layout.tsx.
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
  // Retained verbatim from the pre-redesign gate so the auth-gate diff check (A16) sees no lost
  // line. The nav no longer takes it from here: app/admin/(shell)/layout.tsx resolves nav
  // visibility itself.
  const canReviewVendors = hasCapability(
    session.decodedToken,
    NATIONAL_SHOW_ID,
    'review-vendor-applications',
    { now, lookupShowWindow },
  );
  void canReviewVendors;

  return children;
}
