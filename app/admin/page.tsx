import { redirect } from 'next/navigation';
import { getFirestore } from 'firebase-admin/firestore';

import { getAdminSession } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { TicketsTable } from '@/components/admin/TicketsTable';
import type { ShowIdentity } from '@/types';
import type { Ticket, TicketType, TicketStatus } from '@/types/index';

// This dashboard gets the site's chrome directly (rather than via a shared
// app/admin/layout.tsx) because a layout at that level would also wrap
// /admin/door and /admin/login, both of which must NOT inherit it — see
// app/admin/login/layout.tsx and app/admin/door/layout.tsx for why each is
// scoped to its own subtree.
export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  const [show, tickets] = await Promise.all([
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    fetchTickets(),
  ]);

  return (
    <>
      <UtilityBar show={show} />
      <Header />
      <main>
        <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8 sm:py-16">
          <span className="eyebrow">Admin</span>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">
              Ticket Admin
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
    };
  });
}
