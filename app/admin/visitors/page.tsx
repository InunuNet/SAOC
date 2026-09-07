import Link from 'next/link';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession } from '@/lib/admin-auth';
import { resolveAdminNavCapabilities } from '@/lib/admin-nav-capabilities';
import { initAdmin } from '@/lib/firebase-admin';
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminSectionNav } from '@/components/admin/AdminSectionNav';
import { PartyBadge } from '@/components/admin/PartyBadge';
import type { ShowIdentity } from '@/types';

/**
 * /admin/visitors (F14/F16, nos-design-system M5) — the Visitors section landing page. Holds
 * ticket orders and holders; the full table lives at /admin/visitors/tickets (moved from the
 * old /admin). See goldens/m5-admin-ia.golden.md §1-2.
 */
export const dynamic = 'force-dynamic';

export default async function VisitorsAdminPage() {
  const session = await getAdminSession();
  const { canReviewVendors, canManagePaymentSettings } = await resolveAdminNavCapabilities(
    session.ok ? session.decodedToken : undefined,
  );

  const [show, ticketCounts] = await Promise.all([
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    fetchTicketCounts(),
  ]);

  return (
    <>
      <UtilityBar show={show} />
      <Header />
      <AdminNav
        variant="bar"
        canReviewVendors={canReviewVendors}
        canManagePaymentSettings={canManagePaymentSettings}
      />
      <AdminSectionNav
        ariaLabel="Visitors sections"
        links={[
          { label: 'Overview', href: '/admin/visitors' },
          { label: 'Tickets', href: '/admin/visitors/tickets' },
        ]}
      />
      <main>
        <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8 sm:py-16">
          <span className="eyebrow">
            Admin <PartyBadge type="visitor" />
          </span>
          <h1 className="mt-4 font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">
            Visitors
          </h1>
          <p className="mt-2 max-w-[560px] font-sans text-[15px] text-muted">
            Ticket orders and holders — everyone who has booked, reserved or checked in to the
            show as a member of the public.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="border border-rule bg-bone px-6 py-6">
              <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                Total positions
              </span>
              <span className="mt-1 block font-serif text-[32px] font-semibold text-ink">
                {ticketCounts.total}
              </span>
            </div>
            <div className="border border-rule bg-bone px-6 py-6">
              <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                Reserved (not yet paid)
              </span>
              <span className="mt-1 block font-serif text-[32px] font-semibold text-ink">
                {ticketCounts.reserved}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/admin/visitors/tickets"
              className="inline-block rounded-sm border border-rule bg-ivory px-4 py-2.5 font-sans text-[14px] font-medium text-ink transition-colors hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
            >
              View ticket table →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function fetchTicketCounts(): Promise<{ total: number; reserved: number }> {
  const db = getFirestore(initAdmin());
  const tickets = db.collection('tickets');

  const [totalSnapshot, reservedSnapshot] = await Promise.all([
    tickets.count().get(),
    tickets.where('status', '==', 'reserved').count().get(),
  ]);

  return {
    total: totalSnapshot.data().count,
    reserved: reservedSnapshot.data().count,
  };
}
