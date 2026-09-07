import Link from 'next/link';

import { getAdminSession } from '@/lib/admin-auth';
import { resolveAdminNavCapabilities } from '@/lib/admin-nav-capabilities';
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { AdminNav } from '@/components/admin/AdminNav';
import { PartyBadge } from '@/components/admin/PartyBadge';
import type { ShowIdentity } from '@/types';

/**
 * /admin/exhibitors (F14, nos-design-system M5) — DECLARED EMPTY, deliberately.
 *
 * There is no exhibitor data model. Verified 2026-09-07: the Firestore collections are
 * adminSettings, buyers, checkinAttempts, contactSubmissions, orders,
 * supporterRegistrations, tickets, vendorApplications, vendorStandOrders, vendorSubmissions.
 * Sanity's showExhibitorInfo/showExhibitorStep are editorial guidance content, not entries.
 * See platform-README.md D-A2 and goldens/m5-admin-ia.golden.md §5.
 *
 * This page must NEVER read from, or name, an exhibitor Firestore collection (M5/A7) and
 * must render its empty region behind a `data-placeholder` marker (M5/A8) — no rows, no
 * fabricated counts, no "0 of 0" table chrome implying a pipeline that doesn't exist.
 */
export const dynamic = 'force-dynamic';

export default async function ExhibitorsAdminPage() {
  const session = await getAdminSession();
  const { canReviewVendors, canManagePaymentSettings } = await resolveAdminNavCapabilities(
    session.ok ? session.decodedToken : undefined,
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
      <main>
        <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8 sm:py-16">
          <span className="eyebrow">
            Admin <PartyBadge type="exhibitor" />
          </span>
          <h1 className="mt-4 font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">
            Exhibitors
          </h1>

          <div
            data-placeholder="exhibitors-not-yet-collected"
            className="mt-8 max-w-[640px] border border-rule bg-ivory px-6 py-10 text-center"
          >
            <p className="font-sans text-[15px] text-ink">
              Exhibitor entries are not yet accepted online. There is no exhibitor pipeline in
              this system today.
            </p>
            <p className="mt-3 font-sans text-[14px] text-muted">
              Public guidance for prospective exhibitors lives at{' '}
              <Link
                href="/national-show/exhibitors"
                className="text-ink underline hover:text-accent"
              >
                /national-show/exhibitors
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
