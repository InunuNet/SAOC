import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession } from '@/lib/admin-auth';
import { resolveAdminNavCapabilities } from '@/lib/admin-nav-capabilities';
import { initAdmin } from '@/lib/firebase-admin';
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { TicketsTable } from '@/components/admin/TicketsTable';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminSectionNav } from '@/components/admin/AdminSectionNav';
import { PartyBadge } from '@/components/admin/PartyBadge';
import type { ShowIdentity } from '@/types';
import type { Ticket, TicketType, TicketStatus } from '@/types/index';

/**
 * /admin/visitors/tickets (F16, nos-design-system M5) — MOVED from app/admin/page.tsx,
 * unchanged in behaviour: same fetchTickets() shape, same TicketsTable, same CSV export
 * link. /admin is now the queue-rack overview; this is where the full ticket table lives.
 * See goldens/m5-admin-ia.golden.md §1: "/admin must not 404-or-redirect the old table" — it
 * links here instead.
 *
 * This page never otherwise reads cookies/headers itself beyond getAdminSession() (called
 * again here, same re-derivation pattern app/admin/vendors/page.tsx already uses), so Next
 * has no other signal to treat it as dynamic — force-dynamic is required or a cloud build
 * prerenders it and initAdmin() throws (see app/admin/vendors/page.tsx:32).
 */
export const dynamic = 'force-dynamic';

export default async function VisitorsTicketsAdminPage() {
  const session = await getAdminSession();
  const { canReviewVendors, canManagePaymentSettings } = await resolveAdminNavCapabilities(
    session.ok ? session.decodedToken : undefined,
  );

  const [show, tickets] = await Promise.all([
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    fetchTickets(),
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
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">
              Ticket Orders
            </h1>
            <a
              href="/api/admin/export-csv"
              className="inline-block rounded-sm border border-rule bg-ivory px-4 py-2.5 font-sans text-[14px] font-medium text-ink transition-colors hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
            >
              Download CSV
            </a>
          </div>

          <div className="mt-8">
            <TicketsTable tickets={tickets} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function fetchTickets(): Promise<Ticket[]> {
  const db = getFirestore(initAdmin());
  const snapshot = await db.collection('tickets').get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      bookingRef: data['bookingRef'] as string,
      showId: data['showId'] as string,
      attendeeName: data['attendeeName'] as string,
      attendeeEmail: data['attendeeEmail'] as string,
      ticketType: data['ticketType'] as TicketType,
      status: data['status'] as TicketStatus,
      amount: data['amount'] as number,
      purchasedAt: data['purchasedAt'] ?? null,
      checkedInAt: data['checkedInAt'] ?? null,
      m_payment_id: data['m_payment_id'] ?? null,
      pf_payment_id: data['pf_payment_id'] ?? null,
      orderId: data['orderId'] ?? null,
    };
  });
}
