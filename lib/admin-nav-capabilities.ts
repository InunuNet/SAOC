import type { DecodedIdToken } from 'firebase-admin/auth';

import { hasCapability } from '@/lib/admin-auth';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

/**
 * F14 (nos-design-system M5) — factors out the "derive the two AdminNav capability props from
 * a decoded session token" block that app/admin/page.tsx, app/admin/vendors/page.tsx,
 * app/admin/vendors/applications/page.tsx and app/admin/door/page.tsx each already
 * hand-duplicated identically before this feature added three more call sites
 * (visitors/exhibitors/visitors-tickets pages). Pure passthrough to
 * lib/admin-auth.ts's hasCapability() — no new authorization logic, no new capability, no
 * caching. AdminNav itself still never imports getAdminSession or hasCapability directly (see
 * components/admin/AdminNav.tsx's own header comment) — only page/layout Server Components
 * call this.
 */
export async function resolveAdminNavCapabilities(
  decodedToken: DecodedIdToken | undefined,
): Promise<{ canReviewVendors: boolean; canManagePaymentSettings: boolean }> {
  if (!decodedToken) {
    return { canReviewVendors: false, canManagePaymentSettings: false };
  }

  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);

  return {
    canReviewVendors: hasCapability(decodedToken, NATIONAL_SHOW_ID, 'review-vendor-applications', {
      now,
      lookupShowWindow,
    }),
    canManagePaymentSettings: hasCapability(decodedToken, NATIONAL_SHOW_ID, 'manage-payment-settings', {
      now,
      lookupShowWindow,
    }),
  };
}
