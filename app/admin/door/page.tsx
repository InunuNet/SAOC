import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { AdminNav } from '@/components/admin/AdminNav';
import { DoorScannerClient } from '@/components/admin/DoorScannerClient';

// Server Component wrapper for the door check-in scanner (F1 admin-nav-menu). The
// session check itself already lives in app/admin/door/layout.tsx — getAdminSession()
// is called again here, same pattern app/admin/vendors/page.tsx uses, only to derive
// canReviewVendors for AdminNav's minimal variant. The scanner's own camera lifecycle
// and manual-entry fallback live, unchanged, in components/admin/DoorScannerClient.tsx.
//
// AdminNav here MUST stay variant="minimal" — never "bar". A persistent nav bar is an
// obstacle for a volunteer scanning tickets one-handed at a show entrance in bright
// daylight (see DoorScannerClient.tsx's own comment); the minimal trigger occupies
// effectively zero vertical space until explicitly opened.
export default async function DoorPage() {
  const session = await getAdminSession();
  let canReviewVendors = false;
  let canManagePaymentSettings = false;
  if (session.ok) {
    const now = new Date();
    const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
    canReviewVendors = hasCapability(
      session.decodedToken,
      NATIONAL_SHOW_ID,
      'review-vendor-applications',
      { now, lookupShowWindow },
    );
    canManagePaymentSettings = hasCapability(
      session.decodedToken,
      NATIONAL_SHOW_ID,
      'manage-payment-settings',
      { now, lookupShowWindow },
    );
  }

  return (
    <>
      <AdminNav
        variant="minimal"
        canReviewVendors={canReviewVendors}
        canManagePaymentSettings={canManagePaymentSettings}
      />
      <DoorScannerClient />
    </>
  );
}
